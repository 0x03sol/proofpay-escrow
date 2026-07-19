// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IDisputeModule} from "./interfaces/IDisputeModule.sol";
import {IProofPayEscrow} from "./interfaces/IProofPayEscrow.sol";

/// @title DisputeModule
/// @notice Pluggable arbitration for ProofPay escrows. The escrow notifies this module
///         when a dispute is opened; the configured arbitrator later resolves it by
///         choosing a basis-points split, which this module forwards to the escrow.
///
///         The arbitrator's power is intentionally bounded: it can only pick how a single
///         disputed escrow is split between that escrow's real payer and merchant. It can
///         never name an arbitrary beneficiary or touch any other escrow - those invariants
///         are enforced by {ProofPayEscrow.resolveDispute}.
/// @dev Holds no funds. Evidence is stored as content hashes only (no PII on-chain).
contract DisputeModule is IDisputeModule, Ownable2Step {
    uint256 public constant BPS_DENOMINATOR = 10_000;

    enum DisputeState {
        None,
        Open,
        Resolved
    }

    struct Dispute {
        address opener;
        address payer;
        address merchant;
        uint64 openedAt;
        DisputeState state;
        bytes32 payerEvidence; // keccak256 of the payer's off-chain evidence bundle
        bytes32 merchantEvidence; // keccak256 of the merchant's off-chain evidence bundle
    }

    /// @notice The escrow this module arbitrates for. Set once.
    IProofPayEscrow public escrow;
    /// @notice The address permitted to resolve disputes (EOA, multisig, or future module).
    address public arbitrator;

    mapping(uint256 invoiceId => Dispute dispute) private _disputes;

    event EscrowSet(address indexed escrow);
    event ArbitratorUpdated(address indexed previous, address indexed current);
    event DisputeRegistered(uint256 indexed invoiceId, address indexed opener, address payer, address merchant);
    event EvidenceSubmitted(uint256 indexed invoiceId, address indexed party, bytes32 evidenceHash);
    event DisputeResolved(uint256 indexed invoiceId, uint256 payerBps);

    error ZeroAddress();
    error EscrowAlreadySet();
    error OnlyEscrow();
    error OnlyArbitrator();
    error DisputeAlreadyExists(uint256 invoiceId);
    error DisputeNotOpen(uint256 invoiceId);
    error NotDisputeParty(uint256 invoiceId);
    error InvalidBps();

    modifier onlyEscrow() {
        if (msg.sender != address(escrow)) revert OnlyEscrow();
        _;
    }

    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) revert OnlyArbitrator();
        _;
    }

    constructor(address arbitrator_, address owner_) Ownable(owner_) {
        if (arbitrator_ == address(0)) revert ZeroAddress();
        arbitrator = arbitrator_;
        emit ArbitratorUpdated(address(0), arbitrator_);
    }

    /// @notice Wire the module to its escrow. One-time, owner-only.
    function setEscrow(address escrow_) external onlyOwner {
        if (escrow_ == address(0)) revert ZeroAddress();
        if (address(escrow) != address(0)) revert EscrowAlreadySet();
        escrow = IProofPayEscrow(escrow_);
        emit EscrowSet(escrow_);
    }

    /// @notice Update the arbitrator (e.g. rotate to a multisig or professional arbitrator).
    function setArbitrator(address arbitrator_) external onlyOwner {
        if (arbitrator_ == address(0)) revert ZeroAddress();
        emit ArbitratorUpdated(arbitrator, arbitrator_);
        arbitrator = arbitrator_;
    }

    /// @inheritdoc IDisputeModule
    function onDisputeOpened(uint256 invoiceId, address opener, address payer, address merchant)
        external
        onlyEscrow
    {
        Dispute storage d = _disputes[invoiceId];
        if (d.state != DisputeState.None) revert DisputeAlreadyExists(invoiceId);
        d.opener = opener;
        d.payer = payer;
        d.merchant = merchant;
        d.openedAt = uint64(block.timestamp);
        d.state = DisputeState.Open;
        emit DisputeRegistered(invoiceId, opener, payer, merchant);
    }

    /// @notice Attach a content hash of off-chain evidence. Only the dispute's payer or merchant.
    function submitEvidence(uint256 invoiceId, bytes32 evidenceHash) external {
        Dispute storage d = _disputes[invoiceId];
        if (d.state != DisputeState.Open) revert DisputeNotOpen(invoiceId);
        if (msg.sender == d.payer) {
            d.payerEvidence = evidenceHash;
        } else if (msg.sender == d.merchant) {
            d.merchantEvidence = evidenceHash;
        } else {
            revert NotDisputeParty(invoiceId);
        }
        emit EvidenceSubmitted(invoiceId, msg.sender, evidenceHash);
    }

    /// @notice Resolve a dispute with a payer/merchant split in basis points.
    /// @param payerBps Portion (of 10_000) returned to the payer; the rest goes to the merchant.
    function resolve(uint256 invoiceId, uint256 payerBps) external onlyArbitrator {
        if (payerBps > BPS_DENOMINATOR) revert InvalidBps();
        Dispute storage d = _disputes[invoiceId];
        if (d.state != DisputeState.Open) revert DisputeNotOpen(invoiceId);
        d.state = DisputeState.Resolved;
        emit DisputeResolved(invoiceId, payerBps);
        escrow.resolveDispute(invoiceId, payerBps);
    }

    /// @notice Read a dispute record.
    function getDispute(uint256 invoiceId) external view returns (Dispute memory) {
        return _disputes[invoiceId];
    }
}
