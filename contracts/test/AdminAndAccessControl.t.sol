// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ProofPayBase} from "./helpers/ProofPayBase.sol";
import {ProofPayEscrow} from "../src/ProofPayEscrow.sol";
import {DojangVerifier} from "../src/DojangVerifier.sol";
import {DojangAttesterId, DojangAttesterIds} from "../src/libraries/DojangTypes.sol";

contract AdminAndAccessControlTest is ProofPayBase {
    function test_feeCap_enforcedInConstructor() public {
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.FeeTooHigh.selector, uint256(101)));
        new ProofPayEscrow(address(registry), address(verifier), feeRecipient, 101, owner);
    }

    function test_setFeeBps_enforcesCap() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.FeeTooHigh.selector, uint256(101)));
        escrow.setFeeBps(101);

        vm.prank(owner);
        escrow.setFeeBps(100); // exactly the cap is allowed
        assertEq(escrow.feeBps(), 100);
    }

    function test_maxFeeIsOnePercent() public view {
        assertEq(escrow.MAX_FEE_BPS(), 100);
        assertEq(escrow.BPS_DENOMINATOR(), 10_000);
    }

    function test_onlyOwner_setters() public {
        vm.startPrank(stranger);
        vm.expectRevert();
        escrow.setFeeBps(10);
        vm.expectRevert();
        escrow.setFeeRecipient(stranger);
        vm.expectRevert();
        escrow.setDisputeModule(address(0xBEEF));
        vm.expectRevert();
        escrow.pause();
        vm.stopPrank();
    }

    /// @notice Non-custodial guarantee: the owner has no function to move escrowed funds.
    ///         Funds can only be released by the payer, refunded to the payer, or split by
    ///         the dispute module. The owner attempting privileged flows must fail.
    function test_nonCustodial_ownerCannotMoveFunds() public {
        uint256 amount = 8 ether;
        uint256 id = _createNativeInvoice(amount);
        _fundNative(id, payer, amount);

        // Owner is neither payer nor merchant; every fund-moving path rejects them.
        vm.startPrank(owner);
        vm.expectRevert(ProofPayEscrow.OnlyPayer.selector);
        escrow.release(id);
        vm.expectRevert(ProofPayEscrow.OnlyMerchant.selector);
        escrow.refundByMerchant(id);
        vm.expectRevert(ProofPayEscrow.OnlyDisputeModule.selector);
        escrow.resolveDispute(id, 10_000);
        vm.stopPrank();

        // Escrow still holds the funds intact.
        assertEq(address(escrow).balance, amount);
    }

    function test_setFeeRecipient_zeroReverts() public {
        vm.prank(owner);
        vm.expectRevert(ProofPayEscrow.ZeroAddress.selector);
        escrow.setFeeRecipient(address(0));
    }

    // ----- DojangVerifier configuration -----

    function test_verifier_addAndRemoveAttester() public {
        DojangAttesterId newId = DojangAttesterId.wrap(keccak256("some.other.issuer"));
        vm.prank(owner);
        verifier.addAttester(newId);
        assertTrue(verifier.isTrustedAttester(newId));

        vm.prank(owner);
        verifier.removeAttester(newId);
        assertFalse(verifier.isTrustedAttester(newId));
    }

    function test_verifier_cannotRemoveLastAttester() public {
        vm.prank(owner);
        vm.expectRevert(DojangVerifier.NoAttestersConfigured.selector);
        verifier.removeAttester(DojangAttesterIds.UPBIT_KOREA);
    }

    function test_verifier_onlyOwnerCanConfigure() public {
        vm.prank(stranger);
        vm.expectRevert();
        verifier.addAttester(DojangAttesterId.wrap(keccak256("x")));
    }

    function test_verifier_setScrollZeroReverts() public {
        vm.prank(owner);
        vm.expectRevert(DojangVerifier.ZeroAddress.selector);
        verifier.setScroll(address(0));
    }
}
