// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IDisputeModule
/// @notice Arbitration hook invoked by the escrow when a dispute is opened.
interface IDisputeModule {
    /// @notice Notifies the module that a dispute was opened for `invoiceId`.
    /// @dev Only callable by the escrow. `payer` and `merchant` are the only addresses
    ///      a resolution may pay out to, enforced by the escrow.
    function onDisputeOpened(uint256 invoiceId, address opener, address payer, address merchant) external;
}
