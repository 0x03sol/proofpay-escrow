// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ProofPayBase} from "./helpers/ProofPayBase.sol";
import {ProofPayEscrow} from "../src/ProofPayEscrow.sol";
import {DisputeModule} from "../src/DisputeModule.sol";
import {InvoiceStatus} from "../src/interfaces/IInvoiceRegistry.sol";

contract DisputeFlowTest is ProofPayBase {
    uint256 internal constant AMOUNT = 10 ether;

    function _fundedInvoice() internal returns (uint256 id) {
        id = _createNativeInvoice(AMOUNT);
        _fundNative(id, payer, AMOUNT);
    }

    function test_openDispute_byPayer_locksEscrow() public {
        uint256 id = _fundedInvoice();
        vm.prank(payer);
        escrow.openDispute(id);

        (,, bool disputed,) = escrow.getEscrow(id);
        assertTrue(disputed);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Disputed));

        // Locked: neither release nor refund works while disputed.
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.EscrowIsDisputed.selector, id));
        escrow.release(id);

        vm.prank(merchant);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.EscrowIsDisputed.selector, id));
        escrow.refundByMerchant(id);
    }

    function test_openDispute_onlyParties() public {
        uint256 id = _fundedInvoice();
        vm.prank(stranger);
        vm.expectRevert(ProofPayEscrow.NotDisputeParty.selector);
        escrow.openDispute(id);
    }

    function test_resolve_splitsFundsWithFeeOnMerchantPortion() public {
        uint256 id = _fundedInvoice();
        vm.prank(merchant);
        escrow.openDispute(id);

        // Evidence from both sides.
        vm.prank(payer);
        disputeModule.submitEvidence(id, keccak256("payer-evidence"));
        vm.prank(merchant);
        disputeModule.submitEvidence(id, keccak256("merchant-evidence"));

        uint256 payerBps = 6_000; // 60% back to payer
        uint256 payerAmount = AMOUNT * payerBps / 10_000;
        uint256 merchantGross = AMOUNT - payerAmount;
        uint256 fee = merchantGross * DEFAULT_FEE_BPS / 10_000;
        uint256 merchantAmount = merchantGross - fee;

        uint256 payerBefore = payer.balance;
        uint256 merchantBefore = merchant.balance;
        uint256 feeBefore = feeRecipient.balance;

        vm.prank(arbitrator);
        disputeModule.resolve(id, payerBps);

        assertEq(payer.balance - payerBefore, payerAmount);
        assertEq(merchant.balance - merchantBefore, merchantAmount);
        assertEq(feeRecipient.balance - feeBefore, fee);
        assertEq(address(escrow).balance, 0);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Resolved));
    }

    function test_resolve_onlyArbitrator() public {
        uint256 id = _fundedInvoice();
        vm.prank(payer);
        escrow.openDispute(id);
        vm.prank(stranger);
        vm.expectRevert(DisputeModule.OnlyArbitrator.selector);
        disputeModule.resolve(id, 5_000);
    }

    function test_resolveDispute_onlyCallableByModule() public {
        uint256 id = _fundedInvoice();
        vm.prank(payer);
        escrow.openDispute(id);
        // Direct call to escrow (bypassing the module) must fail.
        vm.prank(arbitrator);
        vm.expectRevert(ProofPayEscrow.OnlyDisputeModule.selector);
        escrow.resolveDispute(id, 5_000);
    }

    function test_submitEvidence_onlyParties() public {
        uint256 id = _fundedInvoice();
        vm.prank(payer);
        escrow.openDispute(id);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(DisputeModule.NotDisputeParty.selector, id));
        disputeModule.submitEvidence(id, keccak256("x"));
    }

    function test_resolve_fullToPayer() public {
        uint256 id = _fundedInvoice();
        vm.prank(payer);
        escrow.openDispute(id);

        uint256 payerBefore = payer.balance;
        vm.prank(arbitrator);
        disputeModule.resolve(id, 10_000);
        assertEq(payer.balance - payerBefore, AMOUNT);
        assertEq(address(escrow).balance, 0);
    }

    function test_openDispute_requiresModuleFunded() public {
        uint256 id = _createNativeInvoice(AMOUNT); // not funded
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.EscrowNotFunded.selector, id));
        escrow.openDispute(id);
    }
}
