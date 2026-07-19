// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ProofPayBase} from "./helpers/ProofPayBase.sol";
import {ProofPayEscrow} from "../src/ProofPayEscrow.sol";
import {InvoiceStatus} from "../src/interfaces/IInvoiceRegistry.sol";

contract EscrowNativeTest is ProofPayBase {
    function test_fundAndRelease_paysMerchantMinusFee() public {
        uint256 amount = 10 ether;
        uint256 id = _createNativeInvoice(amount);
        _fundNative(id, payer, amount);

        assertEq(address(escrow).balance, amount);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Funded));
        (address p,, bool disputed, uint256 held) = escrow.getEscrow(id);
        assertEq(p, payer);
        assertFalse(disputed);
        assertEq(held, amount);

        uint256 expectedFee = amount * DEFAULT_FEE_BPS / 10_000;
        uint256 expectedMerchant = amount - expectedFee;

        uint256 merchantBefore = merchant.balance;
        uint256 feeBefore = feeRecipient.balance;

        vm.prank(payer);
        escrow.release(id);

        assertEq(merchant.balance - merchantBefore, expectedMerchant);
        assertEq(feeRecipient.balance - feeBefore, expectedFee);
        assertEq(address(escrow).balance, 0);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Released));
    }

    function test_release_onlyPayer() public {
        uint256 id = _createNativeInvoice(1 ether);
        _fundNative(id, payer, 1 ether);
        vm.prank(merchant);
        vm.expectRevert(ProofPayEscrow.OnlyPayer.selector);
        escrow.release(id);
    }

    function test_fund_revertsIfMerchantNotVerified() public {
        uint256 id = _createNativeInvoice(1 ether);
        // Merchant loses verification (attestation revoked) before funding.
        _revokeAddress(merchant);
        vm.deal(payer, 1 ether);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.MerchantNotVerified.selector, merchant));
        escrow.fund{value: 1 ether}(id);
    }

    function test_fund_revertsOnIncorrectNativeValue() public {
        uint256 id = _createNativeInvoice(1 ether);
        vm.deal(payer, 2 ether);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.IncorrectNativeValue.selector, 1 ether, 0.5 ether));
        escrow.fund{value: 0.5 ether}(id);
    }

    function test_fund_revertsIfNotOpen() public {
        uint256 id = _createNativeInvoice(1 ether);
        _fundNative(id, payer, 1 ether);
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.InvoiceNotOpen.selector, id));
        escrow.fund{value: 1 ether}(id);
    }

    function test_fund_respectsExpectedPayer() public {
        uint256 id = _createNativeInvoice(1 ether, payer, 0, 0, false);
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.PayerNotAllowed.selector, stranger));
        escrow.fund{value: 1 ether}(id);
    }

    function test_fund_requiresVerifiedPayerWhenSet() public {
        uint256 id = _createNativeInvoice(1 ether, address(0), 0, 0, true);
        vm.deal(payer, 1 ether);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.PayerNotVerified.selector, payer));
        escrow.fund{value: 1 ether}(id);

        // Once the payer is verified, funding succeeds.
        _verifyAddress(payer);
        vm.prank(payer);
        escrow.fund{value: 1 ether}(id);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Funded));
    }

    function test_fund_revertsAfterFundingWindow() public {
        uint64 deadline = uint64(block.timestamp + 1 days);
        uint256 id = _createNativeInvoice(1 ether, address(0), deadline, 0, false);
        vm.warp(deadline + 1);
        vm.deal(payer, 1 ether);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.FundingWindowClosed.selector, id));
        escrow.fund{value: 1 ether}(id);
    }

    function test_refundByMerchant_returnsFullAmount() public {
        uint256 id = _createNativeInvoice(5 ether);
        _fundNative(id, payer, 5 ether);
        uint256 payerBefore = payer.balance;

        vm.prank(merchant);
        escrow.refundByMerchant(id);

        assertEq(payer.balance - payerBefore, 5 ether);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Refunded));
    }

    function test_refundByMerchant_onlyMerchant() public {
        uint256 id = _createNativeInvoice(1 ether);
        _fundNative(id, payer, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(ProofPayEscrow.OnlyMerchant.selector);
        escrow.refundByMerchant(id);
    }

    function test_refundExpired_permissionlessAfterWindow() public {
        uint64 refundAfter = 7 days;
        uint256 id = _createNativeInvoice(3 ether, address(0), 0, refundAfter, false);
        _fundNative(id, payer, 3 ether);

        // Too early.
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.RefundWindowNotReached.selector, id));
        escrow.refundExpired(id);

        vm.warp(block.timestamp + refundAfter);
        uint256 payerBefore = payer.balance;
        // Anyone can trigger the timeout refund.
        vm.prank(stranger);
        escrow.refundExpired(id);
        assertEq(payer.balance - payerBefore, 3 ether);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Refunded));
    }

    function test_refundExpired_revertsWhenDisabled() public {
        uint256 id = _createNativeInvoice(1 ether); // refundAfter = 0
        _fundNative(id, payer, 1 ether);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.TimeoutRefundDisabled.selector, id));
        escrow.refundExpired(id);
    }

    function test_pause_blocksFunding() public {
        uint256 id = _createNativeInvoice(1 ether);
        vm.prank(owner);
        escrow.pause();
        vm.deal(payer, 1 ether);
        vm.prank(payer);
        vm.expectRevert();
        escrow.fund{value: 1 ether}(id);
    }

    function test_release_revertsWhenNotFunded() public {
        uint256 id = _createNativeInvoice(1 ether);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.EscrowNotFunded.selector, id));
        escrow.release(id);
    }
}
