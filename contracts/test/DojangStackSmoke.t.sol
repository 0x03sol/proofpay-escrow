// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DojangTestKit} from "./helpers/DojangTestKit.sol";
import {DojangVerifier} from "../src/DojangVerifier.sol";
import {DojangAttesterId, DojangAttesterIds} from "../src/libraries/DojangTypes.sol";

/// @notice Validates the no-mock Dojang harness: verification reflects a real, revocable
///         EAS attestation read through the genuine DojangScroll read layer.
contract DojangStackSmokeTest is DojangTestKit {
    DojangVerifier internal verifier;

    function setUp() public {
        _deployDojangStack(address(this));

        DojangAttesterId[] memory ids = new DojangAttesterId[](1);
        ids[0] = DojangAttesterIds.UPBIT_KOREA;
        verifier = new DojangVerifier(address(dojangScroll), ids, address(this));
    }

    function test_unverifiedByDefault() public {
        address stranger = makeAddr("stranger");
        assertFalse(verifier.isVerified(stranger));
    }

    function test_verifyThenRevoke() public {
        address merchant = makeAddr("merchant");
        assertFalse(verifier.isVerified(merchant));

        _verifyAddress(merchant);
        assertTrue(verifier.isVerified(merchant), "should be verified after real attestation");

        _revokeAddress(merchant);
        assertFalse(verifier.isVerified(merchant), "should be unverified after real revocation");
    }

    function test_attesterIdMatchesLiveChain() public view {
        // The id we use must equal the canonical UPBIT_KOREA id verified on GIWA Sepolia.
        assertEq(
            DojangAttesterId.unwrap(DojangAttesterIds.UPBIT_KOREA),
            0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034
        );
    }
}
