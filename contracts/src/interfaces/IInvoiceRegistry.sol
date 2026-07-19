// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Lifecycle state of an invoice. Terminal states: Released, Refunded, Cancelled, Resolved.
enum InvoiceStatus {
    None,
    Open,
    Funded,
    Released,
    Refunded,
    Disputed,
    Cancelled,
    Resolved
}

/// @notice On-chain commercial record. No PII or invoice documents are stored - only a content hash.
struct Invoice {
    address merchant; // recipient of settled funds; must be Dojang-verified at funding time
    address token; // address(0) == native ETH, otherwise a whitelisted ERC-20
    address payer; // expected payer; address(0) == open to any payer (recorded on funding)
    uint256 amount; // exact required payment, in the asset's smallest unit
    uint64 createdAt; // block timestamp at creation
    uint64 fundBy; // absolute deadline to fund; 0 == no funding deadline
    uint64 refundAfter; // seconds after funding until timeout refund is allowed; 0 == disabled
    bool requireVerifiedPayer; // whether the payer must also be Dojang-verified
    InvoiceStatus status;
    bytes32 documentHash; // keccak256 of the off-chain invoice document
}

/// @title IInvoiceRegistry
/// @notice Commercial record layer. The escrow is the sole authority for funding-lifecycle transitions.
interface IInvoiceRegistry {
    function getInvoice(uint256 id) external view returns (Invoice memory);

    function statusOf(uint256 id) external view returns (InvoiceStatus);

    function invoiceCount() external view returns (uint256);

    // --- escrow-only lifecycle transitions ---
    function onFunded(uint256 id, address payer) external;

    function onReleased(uint256 id) external;

    function onRefunded(uint256 id) external;

    function onDisputed(uint256 id) external;

    function onResolved(uint256 id) external;
}
