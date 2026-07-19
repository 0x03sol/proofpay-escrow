// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {IDojangVerifier} from "./interfaces/IDojangVerifier.sol";
import {IInvoiceRegistry, Invoice, InvoiceStatus} from "./interfaces/IInvoiceRegistry.sol";
import {IDisputeModule} from "./interfaces/IDisputeModule.sol";
import {IProofPayEscrow} from "./interfaces/IProofPayEscrow.sol";

/// @title ProofPayEscrow
/// @notice Non-custodial, invoice-backed escrow for GIWA. Funds are paid directly into
///         this contract and can only ever flow to the invoice's payer, the invoice's
///         merchant, or the protocol fee recipient (capped at {MAX_FEE_BPS}).
///
///         NON-CUSTODIAL GUARANTEE: the owner has no function that can move, seize, or
///         redirect escrowed funds. Owner powers are limited to configuration (fee within
///         a hard cap, fee recipient, dispute module, ERC-20 allowlist, pause of new
///         funding). Dispute resolution is delegated to a pluggable {IDisputeModule} that
///         may only split an escrow between its real payer and merchant.
/// @dev Asset routing (native ETH and whitelisted ERC-20) is handled internally rather than
///      via a separate pass-through router, avoiding needless indirection and trust surface.
contract ProofPayEscrow is IProofPayEscrow, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    /// @notice Basis-points denominator (100% == 10_000).
    uint256 public constant BPS_DENOMINATOR = 10_000;
    /// @notice Hard cap on the protocol fee: 1.0%.
    uint256 public constant MAX_FEE_BPS = 100;

    /// @notice Reason a refund was issued, for off-chain indexing.
    enum RefundReason {
        Merchant,
        Timeout
    }

    /// @notice Live custody state for a funded invoice.
    struct EscrowState {
        address payer; // the address that actually funded the escrow
        uint64 fundedAt; // funding timestamp (for timeout refunds)
        bool disputed; // whether the escrow is locked pending arbitration
        uint256 amount; // exact amount held for this invoice
    }

    /// @notice The commercial record layer this escrow drives.
    IInvoiceRegistry public immutable registry;
    /// @notice The identity gate used to enforce verified counterparties.
    IDojangVerifier public immutable verifier;

    /// @notice Pluggable arbitration module. Only this address may call {resolveDispute}.
    IDisputeModule public disputeModule;
    /// @notice Recipient of the protocol fee.
    address public feeRecipient;
    /// @notice Protocol fee in basis points, always <= {MAX_FEE_BPS}.
    uint256 public feeBps;

    mapping(uint256 invoiceId => EscrowState state) private _escrows;
    /// @notice ERC-20 tokens permitted for settlement. Native ETH (address(0)) is always allowed.
    mapping(address token => bool allowed) public tokenAllowed;

    event PaymentReceived(uint256 indexed invoiceId, address indexed payer, address indexed token, uint256 amount);
    event EscrowReleased(uint256 indexed invoiceId, address indexed merchant, uint256 amountToMerchant, uint256 fee);
    event RefundExecuted(uint256 indexed invoiceId, address indexed payer, uint256 amount, RefundReason reason);
    event DisputeOpened(uint256 indexed invoiceId, address indexed opener);
    event DisputeResolved(uint256 indexed invoiceId, uint256 payerAmount, uint256 merchantAmount, uint256 fee);
    event FeeUpdated(uint256 feeBps);
    event FeeRecipientUpdated(address indexed feeRecipient);
    event DisputeModuleUpdated(address indexed disputeModule);
    event TokenAllowanceUpdated(address indexed token, bool allowed);

    error ZeroAddress();
    error FeeTooHigh(uint256 feeBps);
    error InvoiceNotOpen(uint256 invoiceId);
    error TokenNotAllowed(address token);
    error FundingWindowClosed(uint256 invoiceId);
    error MerchantNotVerified(address merchant);
    error PayerNotAllowed(address payer);
    error PayerNotVerified(address payer);
    error IncorrectNativeValue(uint256 expected, uint256 received);
    error UnexpectedNativeValue();
    error EscrowNotFunded(uint256 invoiceId);
    error EscrowIsDisputed(uint256 invoiceId);
    error EscrowNotDisputed(uint256 invoiceId);
    error OnlyPayer();
    error OnlyMerchant();
    error NotDisputeParty();
    error DisputeModuleNotSet();
    error OnlyDisputeModule();
    error TimeoutRefundDisabled(uint256 invoiceId);
    error RefundWindowNotReached(uint256 invoiceId);
    error InvalidBps();

    constructor(address registry_, address verifier_, address feeRecipient_, uint256 feeBps_, address owner_)
        Ownable(owner_)
    {
        if (registry_ == address(0) || verifier_ == address(0) || feeRecipient_ == address(0)) {
            revert ZeroAddress();
        }
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh(feeBps_);
        registry = IInvoiceRegistry(registry_);
        verifier = IDojangVerifier(verifier_);
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    // ---------------------------------------------------------------------
    // Core lifecycle
    // ---------------------------------------------------------------------

    /// @notice Fund an open invoice, moving it into escrow.
    /// @dev Enforces at funding time (when the payer's money is at risk): the merchant is
    ///      currently verified, the asset is allowed, the funding window is open, and any
    ///      payer restriction / verification requirement is satisfied.
    function fund(uint256 invoiceId) external payable whenNotPaused nonReentrant {
        Invoice memory inv = registry.getInvoice(invoiceId);
        if (inv.status != InvoiceStatus.Open) revert InvoiceNotOpen(invoiceId);
        if (!_isTokenAllowed(inv.token)) revert TokenNotAllowed(inv.token);
        if (inv.fundBy != 0 && block.timestamp > inv.fundBy) revert FundingWindowClosed(invoiceId);
        if (!verifier.isVerified(inv.merchant)) revert MerchantNotVerified(inv.merchant);
        if (inv.payer != address(0) && msg.sender != inv.payer) revert PayerNotAllowed(msg.sender);
        if (inv.requireVerifiedPayer && !verifier.isVerified(msg.sender)) revert PayerNotVerified(msg.sender);

        // Validate the incoming asset before mutating state.
        if (inv.token == address(0)) {
            if (msg.value != inv.amount) revert IncorrectNativeValue(inv.amount, msg.value);
        } else {
            if (msg.value != 0) revert UnexpectedNativeValue();
        }

        // Effects.
        _escrows[invoiceId] =
            EscrowState({payer: msg.sender, fundedAt: uint64(block.timestamp), disputed: false, amount: inv.amount});
        registry.onFunded(invoiceId, msg.sender);

        // Interactions: pull ERC-20 (native already delivered via msg.value).
        if (inv.token != address(0)) {
            IERC20(inv.token).safeTransferFrom(msg.sender, address(this), inv.amount);
        }

        emit PaymentReceived(invoiceId, msg.sender, inv.token, inv.amount);
    }

    /// @notice Release escrowed funds to the merchant. Only the payer (buyer) may release.
    function release(uint256 invoiceId) external nonReentrant {
        EscrowState memory es = _escrows[invoiceId];
        if (es.amount == 0) revert EscrowNotFunded(invoiceId);
        if (es.disputed) revert EscrowIsDisputed(invoiceId);
        if (msg.sender != es.payer) revert OnlyPayer();

        Invoice memory inv = registry.getInvoice(invoiceId);
        (uint256 merchantAmount, uint256 fee) = _split(es.amount);

        delete _escrows[invoiceId];
        registry.onReleased(invoiceId);

        _payOut(inv.token, inv.merchant, merchantAmount);
        if (fee > 0) _payOut(inv.token, feeRecipient, fee);

        emit EscrowReleased(invoiceId, inv.merchant, merchantAmount, fee);
    }

    /// @notice Merchant voluntarily refunds the full escrowed amount to the payer.
    function refundByMerchant(uint256 invoiceId) external nonReentrant {
        EscrowState memory es = _escrows[invoiceId];
        if (es.amount == 0) revert EscrowNotFunded(invoiceId);
        if (es.disputed) revert EscrowIsDisputed(invoiceId);

        Invoice memory inv = registry.getInvoice(invoiceId);
        if (msg.sender != inv.merchant) revert OnlyMerchant();

        delete _escrows[invoiceId];
        registry.onRefunded(invoiceId);

        _payOut(inv.token, es.payer, es.amount);
        emit RefundExecuted(invoiceId, es.payer, es.amount, RefundReason.Merchant);
    }

    /// @notice Permissionless timeout refund to the payer once the refund window elapses.
    /// @dev Protects the buyer if the merchant neither delivers nor the buyer releases.
    function refundExpired(uint256 invoiceId) external nonReentrant {
        EscrowState memory es = _escrows[invoiceId];
        if (es.amount == 0) revert EscrowNotFunded(invoiceId);
        if (es.disputed) revert EscrowIsDisputed(invoiceId);

        Invoice memory inv = registry.getInvoice(invoiceId);
        if (inv.refundAfter == 0) revert TimeoutRefundDisabled(invoiceId);
        if (block.timestamp < uint256(es.fundedAt) + inv.refundAfter) revert RefundWindowNotReached(invoiceId);

        delete _escrows[invoiceId];
        registry.onRefunded(invoiceId);

        _payOut(inv.token, es.payer, es.amount);
        emit RefundExecuted(invoiceId, es.payer, es.amount, RefundReason.Timeout);
    }

    // ---------------------------------------------------------------------
    // Dispute flow
    // ---------------------------------------------------------------------

    /// @notice Open a dispute, locking the escrow until the dispute module resolves it.
    ///         Only the payer or merchant may open a dispute.
    function openDispute(uint256 invoiceId) external {
        if (address(disputeModule) == address(0)) revert DisputeModuleNotSet();

        EscrowState storage es = _escrows[invoiceId];
        if (es.amount == 0) revert EscrowNotFunded(invoiceId);
        if (es.disputed) revert EscrowIsDisputed(invoiceId);

        Invoice memory inv = registry.getInvoice(invoiceId);
        if (msg.sender != es.payer && msg.sender != inv.merchant) revert NotDisputeParty();

        es.disputed = true;
        registry.onDisputed(invoiceId);
        disputeModule.onDisputeOpened(invoiceId, msg.sender, es.payer, inv.merchant);

        emit DisputeOpened(invoiceId, msg.sender);
    }

    /// @inheritdoc IProofPayEscrow
    function resolveDispute(uint256 invoiceId, uint256 payerBps) external nonReentrant {
        if (msg.sender != address(disputeModule)) revert OnlyDisputeModule();
        if (payerBps > BPS_DENOMINATOR) revert InvalidBps();

        EscrowState memory es = _escrows[invoiceId];
        if (es.amount == 0) revert EscrowNotFunded(invoiceId);
        if (!es.disputed) revert EscrowNotDisputed(invoiceId);

        Invoice memory inv = registry.getInvoice(invoiceId);

        uint256 payerAmount = (es.amount * payerBps) / BPS_DENOMINATOR;
        uint256 merchantGross = es.amount - payerAmount;
        uint256 fee = (merchantGross * feeBps) / BPS_DENOMINATOR;
        uint256 merchantAmount = merchantGross - fee;

        delete _escrows[invoiceId];
        registry.onResolved(invoiceId);

        if (payerAmount > 0) _payOut(inv.token, es.payer, payerAmount);
        if (merchantAmount > 0) _payOut(inv.token, inv.merchant, merchantAmount);
        if (fee > 0) _payOut(inv.token, feeRecipient, fee);

        emit DisputeResolved(invoiceId, payerAmount, merchantAmount, fee);
    }

    // ---------------------------------------------------------------------
    // Owner configuration (no fund-movement authority)
    // ---------------------------------------------------------------------

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps);
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    /// @notice Set the dispute module.
    /// @dev Should be set once at deployment and only changed when no disputes are active;
    ///      a dispute opened under a previous module cannot be resolved by a new one.
    function setDisputeModule(address module) external onlyOwner {
        if (module == address(0)) revert ZeroAddress();
        disputeModule = IDisputeModule(module);
        emit DisputeModuleUpdated(module);
    }

    function setTokenAllowed(address token, bool allowed) external onlyOwner {
        if (token == address(0)) revert ZeroAddress(); // native ETH is always allowed implicitly
        tokenAllowed[token] = allowed;
        emit TokenAllowanceUpdated(token, allowed);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Current custody state for an invoice. `amount == 0` means not (or no longer) funded.
    function getEscrow(uint256 invoiceId)
        external
        view
        returns (address payer, uint64 fundedAt, bool disputed, uint256 amount)
    {
        EscrowState memory es = _escrows[invoiceId];
        return (es.payer, es.fundedAt, es.disputed, es.amount);
    }

    /// @notice Whether a token may be used for settlement.
    function isTokenAllowed(address token) external view returns (bool) {
        return _isTokenAllowed(token);
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _split(uint256 amount) private view returns (uint256 merchantAmount, uint256 fee) {
        fee = (amount * feeBps) / BPS_DENOMINATOR;
        merchantAmount = amount - fee;
    }

    function _isTokenAllowed(address token) private view returns (bool) {
        return token == address(0) || tokenAllowed[token];
    }

    function _payOut(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            payable(to).sendValue(amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
