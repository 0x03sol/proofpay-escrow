// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IProofPayEscrow
/// @notice Callback used by the dispute module to execute an arbitrated split.
interface IProofPayEscrow {
    /// @notice Settles a disputed escrow, paying `payerBps` of the escrowed amount to the payer
    ///         and the remainder (minus protocol fee) to the merchant.
    /// @dev Only callable by the configured dispute module. `payerBps` is in basis points (<= 10000).
    function resolveDispute(uint256 invoiceId, uint256 payerBps) external;
}
