// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IDojangVerifier} from "../interfaces/IDojangVerifier.sol";
import {DojangAttesterId} from "../libraries/DojangTypes.sol";

/// @title AlwaysVerifiedVerifier
/// @notice Testnet-only identity gate that treats every address as verified.
/// @dev Use for GIWA Sepolia demos when real Upbit/Dojang attestations are not available.
///      Do NOT use on mainnet — it disables the product's identity guarantees.
contract AlwaysVerifiedVerifier is IDojangVerifier {
    function isVerified(address) external pure returns (bool) {
        return true;
    }

    function isVerifiedBy(address, DojangAttesterId) external pure returns (bool) {
        return true;
    }
}
