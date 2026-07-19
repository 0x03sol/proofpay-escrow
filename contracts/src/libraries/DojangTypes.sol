// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Strongly-typed identifier for a Dojang attestation issuer.
/// @dev Mirrors `DojangAttesterId` from giwa-io/dojang (`type DojangAttesterId is bytes32`)
///      so values are ABI-identical to the deployed DojangScroll read layer.
type DojangAttesterId is bytes32;

/// @notice Canonical, well-known Dojang attester identifiers on GIWA.
library DojangAttesterIds {
    /// @notice Upbit Korea issuer: keccak256("dojang.dojangattesterids.upbitkorea").
    /// @dev Verified on-chain against DojangAttesterBook on GIWA Sepolia.
    DojangAttesterId internal constant UPBIT_KOREA =
        DojangAttesterId.wrap(0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034);
}
