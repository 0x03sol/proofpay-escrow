// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DojangAttesterId} from "../libraries/DojangTypes.sol";

/// @title IDojangVerifier
/// @notice Identity gate used by ProofPay to require Dojang-verified counterparties.
interface IDojangVerifier {
    /// @notice True if `account` is verified by any of the configured trusted attesters.
    function isVerified(address account) external view returns (bool);

    /// @notice True if `account` is verified specifically by `attesterId`.
    function isVerifiedBy(address account, DojangAttesterId attesterId) external view returns (bool);
}
