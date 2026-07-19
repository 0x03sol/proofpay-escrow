// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DojangAttesterId} from "../libraries/DojangTypes.sol";

/// @title IDojangScroll
/// @notice Minimal view interface to GIWA's official Dojang read layer (DojangScroll).
/// @dev The deployed DojangScroll internally resolves the Verified Address attestation
///      via the AttestationIndexer + EAS and checks existence, expiry and revocation.
///      `isVerified` returns false (never reverts) when no valid attestation exists.
interface IDojangScroll {
    /// @notice Whether `addr` holds a valid Verified Address attestation from `attesterId`.
    function isVerified(address addr, DojangAttesterId attesterId) external view returns (bool);

    /// @notice The Verified Address attestation UID for `addr` from `attesterId`.
    /// @dev Reverts if no valid attestation exists.
    function getVerifiedAddressAttestationUid(address addr, DojangAttesterId attesterId)
        external
        view
        returns (bytes32);
}
