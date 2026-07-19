// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IDojangScroll} from "./interfaces/IDojangScroll.sol";
import {IDojangVerifier} from "./interfaces/IDojangVerifier.sol";
import {DojangAttesterId} from "./libraries/DojangTypes.sol";

/// @title DojangVerifier
/// @notice Thin, owner-configurable adapter over GIWA's official DojangScroll read layer.
///         It never issues attestations; it only reads verification status for a
///         configurable set of trusted attesters. This is the single place ProofPay
///         binds to the Dojang identity system, so the issuer set can grow over time
///         (e.g. adding non-Korean KYB issuers) without touching escrow logic.
/// @dev Holds no funds. Owner powers are limited to read-configuration.
contract DojangVerifier is IDojangVerifier, Ownable2Step {
    /// @notice The DojangScroll instance queried for verification status.
    IDojangScroll public scroll;

    /// @dev Ordered list of trusted attester ids; an account is "verified" if any of them attest it.
    DojangAttesterId[] private _attesters;
    /// @dev Membership set mirroring `_attesters` for O(1) existence checks.
    mapping(bytes32 attesterId => bool registered) private _isAttester;

    event ScrollUpdated(address indexed previous, address indexed current);
    event AttesterAdded(DojangAttesterId indexed attesterId);
    event AttesterRemoved(DojangAttesterId indexed attesterId);

    error ZeroAddress();
    error InvalidAttesterId();
    error AttesterAlreadyRegistered(DojangAttesterId attesterId);
    error AttesterNotRegistered(DojangAttesterId attesterId);
    error NoAttestersConfigured();

    /// @param scroll_ Address of the deployed DojangScroll read layer.
    /// @param attesters_ Initial set of trusted attester ids (must be non-empty).
    /// @param owner_ Configuration owner.
    constructor(address scroll_, DojangAttesterId[] memory attesters_, address owner_) Ownable(owner_) {
        if (scroll_ == address(0)) revert ZeroAddress();
        scroll = IDojangScroll(scroll_);
        emit ScrollUpdated(address(0), scroll_);

        uint256 len = attesters_.length;
        for (uint256 i; i < len; ++i) {
            _addAttester(attesters_[i]);
        }
        if (_attesters.length == 0) revert NoAttestersConfigured();
    }

    /// @notice Point the verifier at a new DojangScroll (e.g. after a Dojang upgrade/redeploy).
    function setScroll(address scroll_) external onlyOwner {
        if (scroll_ == address(0)) revert ZeroAddress();
        emit ScrollUpdated(address(scroll), scroll_);
        scroll = IDojangScroll(scroll_);
    }

    /// @notice Add a trusted attester id to the verification set.
    function addAttester(DojangAttesterId attesterId) external onlyOwner {
        _addAttester(attesterId);
    }

    /// @notice Remove a trusted attester id. The set must remain non-empty.
    function removeAttester(DojangAttesterId attesterId) external onlyOwner {
        bytes32 raw = DojangAttesterId.unwrap(attesterId);
        if (!_isAttester[raw]) revert AttesterNotRegistered(attesterId);

        _isAttester[raw] = false;
        uint256 len = _attesters.length;
        for (uint256 i; i < len; ++i) {
            if (DojangAttesterId.unwrap(_attesters[i]) == raw) {
                _attesters[i] = _attesters[len - 1];
                _attesters.pop();
                break;
            }
        }
        if (_attesters.length == 0) revert NoAttestersConfigured();
        emit AttesterRemoved(attesterId);
    }

    /// @inheritdoc IDojangVerifier
    function isVerified(address account) public view returns (bool) {
        uint256 len = _attesters.length;
        for (uint256 i; i < len; ++i) {
            if (scroll.isVerified(account, _attesters[i])) return true;
        }
        return false;
    }

    /// @inheritdoc IDojangVerifier
    function isVerifiedBy(address account, DojangAttesterId attesterId) external view returns (bool) {
        return scroll.isVerified(account, attesterId);
    }

    /// @notice The current set of trusted attester ids.
    function attesters() external view returns (DojangAttesterId[] memory) {
        return _attesters;
    }

    /// @notice Whether `attesterId` is in the trusted set.
    function isTrustedAttester(DojangAttesterId attesterId) external view returns (bool) {
        return _isAttester[DojangAttesterId.unwrap(attesterId)];
    }

    function _addAttester(DojangAttesterId attesterId) private {
        bytes32 raw = DojangAttesterId.unwrap(attesterId);
        if (raw == bytes32(0)) revert InvalidAttesterId();
        if (_isAttester[raw]) revert AttesterAlreadyRegistered(attesterId);
        _isAttester[raw] = true;
        _attesters.push(attesterId);
        emit AttesterAdded(attesterId);
    }
}
