// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IDojangVerifier} from "./interfaces/IDojangVerifier.sol";
import {IInvoiceRegistry, Invoice, InvoiceStatus} from "./interfaces/IInvoiceRegistry.sol";

/// @title InvoiceRegistry
/// @notice The commercial record layer: immutable invoice terms plus a lifecycle status.
///         Merchants create and (while Open) cancel invoices. All funding-lifecycle
///         transitions are driven exclusively by the ProofPayEscrow contract, keeping
///         a single source of truth for status while separating records from custody.
/// @dev Stores only a document hash - never PII or invoice contents.
contract InvoiceRegistry is IInvoiceRegistry, Ownable2Step {
    /// @notice Identity gate used to require verified merchants at creation time.
    IDojangVerifier public immutable verifier;

    /// @notice The escrow authorized to drive funding-lifecycle transitions. Set once.
    address public escrow;

    /// @notice Whether invoice creation requires the merchant to be Dojang-verified.
    bool public requireVerifiedMerchant;

    uint256 private _count;
    mapping(uint256 id => Invoice invoice) private _invoices;

    event EscrowSet(address indexed escrow);
    event RequireVerifiedMerchantUpdated(bool required);
    event InvoiceCreated(
        uint256 indexed id, address indexed merchant, address indexed token, uint256 amount, bytes32 documentHash
    );
    event InvoiceCancelled(uint256 indexed id);
    event InvoiceStatusChanged(uint256 indexed id, InvoiceStatus status);

    error ZeroAddress();
    error EscrowAlreadySet();
    error OnlyEscrow();
    error MerchantNotVerified(address merchant);
    error InvalidAmount();
    error InvoiceNotFound(uint256 id);
    error NotInvoiceMerchant(uint256 id);
    error InvalidStatusTransition(uint256 id, InvoiceStatus from, InvoiceStatus to);

    modifier onlyEscrow() {
        if (msg.sender != escrow) revert OnlyEscrow();
        _;
    }

    constructor(address verifier_, address owner_) Ownable(owner_) {
        if (verifier_ == address(0)) revert ZeroAddress();
        verifier = IDojangVerifier(verifier_);
        requireVerifiedMerchant = true;
    }

    /// @notice Wire the registry to its escrow. One-time, owner-only.
    function setEscrow(address escrow_) external onlyOwner {
        if (escrow_ == address(0)) revert ZeroAddress();
        if (escrow != address(0)) revert EscrowAlreadySet();
        escrow = escrow_;
        emit EscrowSet(escrow_);
    }

    /// @notice Toggle whether merchants must be Dojang-verified to create invoices.
    function setRequireVerifiedMerchant(bool required) external onlyOwner {
        requireVerifiedMerchant = required;
        emit RequireVerifiedMerchantUpdated(required);
    }

    /// @notice Create a new invoice. Caller becomes the merchant (fund recipient).
    /// @param token address(0) for native ETH, otherwise the settlement ERC-20.
    /// @param amount Exact required payment in the asset's smallest unit (> 0).
    /// @param payer Expected payer, or address(0) to allow any payer.
    /// @param fundBy Absolute funding deadline (unix seconds); 0 to disable.
    /// @param refundAfter Seconds after funding before a timeout refund is allowed; 0 to disable.
    /// @param requireVerifiedPayer Whether the payer must also be Dojang-verified.
    /// @param documentHash keccak256 of the off-chain invoice document.
    function createInvoice(
        address token,
        uint256 amount,
        address payer,
        uint64 fundBy,
        uint64 refundAfter,
        bool requireVerifiedPayer,
        bytes32 documentHash
    ) external returns (uint256 id) {
        if (amount == 0) revert InvalidAmount();
        if (requireVerifiedMerchant && !verifier.isVerified(msg.sender)) {
            revert MerchantNotVerified(msg.sender);
        }

        id = ++_count;
        Invoice storage inv = _invoices[id];
        inv.merchant = msg.sender;
        inv.token = token;
        inv.payer = payer;
        inv.amount = amount;
        inv.createdAt = uint64(block.timestamp);
        inv.fundBy = fundBy;
        inv.refundAfter = refundAfter;
        inv.requireVerifiedPayer = requireVerifiedPayer;
        inv.documentHash = documentHash;
        inv.status = InvoiceStatus.Open;

        emit InvoiceCreated(id, msg.sender, token, amount, documentHash);
        emit InvoiceStatusChanged(id, InvoiceStatus.Open);
    }

    /// @notice Cancel an invoice that has not yet been funded. Merchant-only.
    function cancelInvoice(uint256 id) external {
        Invoice storage inv = _invoices[id];
        if (inv.status == InvoiceStatus.None) revert InvoiceNotFound(id);
        if (inv.merchant != msg.sender) revert NotInvoiceMerchant(id);
        if (inv.status != InvoiceStatus.Open) {
            revert InvalidStatusTransition(id, inv.status, InvoiceStatus.Cancelled);
        }
        inv.status = InvoiceStatus.Cancelled;
        emit InvoiceCancelled(id);
        emit InvoiceStatusChanged(id, InvoiceStatus.Cancelled);
    }

    /// @inheritdoc IInvoiceRegistry
    function onFunded(uint256 id, address payer) external onlyEscrow {
        Invoice storage inv = _transition(id, InvoiceStatus.Open, InvoiceStatus.Funded);
        if (inv.payer == address(0)) inv.payer = payer;
    }

    /// @inheritdoc IInvoiceRegistry
    function onReleased(uint256 id) external onlyEscrow {
        _transition(id, InvoiceStatus.Funded, InvoiceStatus.Released);
    }

    /// @inheritdoc IInvoiceRegistry
    function onRefunded(uint256 id) external onlyEscrow {
        _transition(id, InvoiceStatus.Funded, InvoiceStatus.Refunded);
    }

    /// @inheritdoc IInvoiceRegistry
    function onDisputed(uint256 id) external onlyEscrow {
        _transition(id, InvoiceStatus.Funded, InvoiceStatus.Disputed);
    }

    /// @inheritdoc IInvoiceRegistry
    function onResolved(uint256 id) external onlyEscrow {
        _transition(id, InvoiceStatus.Disputed, InvoiceStatus.Resolved);
    }

    /// @inheritdoc IInvoiceRegistry
    function getInvoice(uint256 id) external view returns (Invoice memory) {
        Invoice memory inv = _invoices[id];
        if (inv.status == InvoiceStatus.None) revert InvoiceNotFound(id);
        return inv;
    }

    /// @inheritdoc IInvoiceRegistry
    function statusOf(uint256 id) external view returns (InvoiceStatus) {
        return _invoices[id].status;
    }

    /// @inheritdoc IInvoiceRegistry
    function invoiceCount() external view returns (uint256) {
        return _count;
    }

    function _transition(uint256 id, InvoiceStatus from, InvoiceStatus to)
        private
        returns (Invoice storage inv)
    {
        inv = _invoices[id];
        if (inv.status == InvoiceStatus.None) revert InvoiceNotFound(id);
        if (inv.status != from) revert InvalidStatusTransition(id, inv.status, to);
        inv.status = to;
        emit InvoiceStatusChanged(id, to);
    }
}
