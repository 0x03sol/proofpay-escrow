// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ProofPayBase} from "./helpers/ProofPayBase.sol";
import {InvoiceStatus} from "../src/interfaces/IInvoiceRegistry.sol";

/// @notice Value-conservation invariants: every wei entering escrow must leave to exactly
///         the payer, the merchant, or the fee recipient - never stranded, never minted.
contract ProofPayFuzzTest is ProofPayBase {
    function testFuzz_releaseConservation(uint96 rawAmount, uint8 rawFeeBps) public {
        uint256 amount = bound(rawAmount, 1, 1e24);
        uint256 feeBps = bound(rawFeeBps, 0, escrow.MAX_FEE_BPS());

        vm.prank(owner);
        escrow.setFeeBps(feeBps);

        uint256 id = _createNativeInvoice(amount);
        _fundNative(id, payer, amount);

        uint256 merchantBefore = merchant.balance;
        uint256 feeBefore = feeRecipient.balance;

        vm.prank(payer);
        escrow.release(id);

        uint256 toMerchant = merchant.balance - merchantBefore;
        uint256 toFee = feeRecipient.balance - feeBefore;

        assertEq(toMerchant + toFee, amount, "value must be conserved on release");
        assertLe(toFee, amount * escrow.MAX_FEE_BPS() / 10_000, "fee cannot exceed cap");
        assertEq(address(escrow).balance, 0);
    }

    function testFuzz_disputeSplitConservation(uint96 rawAmount, uint16 rawPayerBps, uint8 rawFeeBps) public {
        uint256 amount = bound(rawAmount, 1, 1e24);
        uint256 payerBps = bound(rawPayerBps, 0, 10_000);
        uint256 feeBps = bound(rawFeeBps, 0, escrow.MAX_FEE_BPS());

        vm.prank(owner);
        escrow.setFeeBps(feeBps);

        uint256 id = _createNativeInvoice(amount);
        _fundNative(id, payer, amount);

        vm.prank(payer);
        escrow.openDispute(id);

        uint256 payerBefore = payer.balance;
        uint256 merchantBefore = merchant.balance;
        uint256 feeBefore = feeRecipient.balance;

        vm.prank(arbitrator);
        disputeModule.resolve(id, payerBps);

        uint256 paidOut = (payer.balance - payerBefore) + (merchant.balance - merchantBefore)
            + (feeRecipient.balance - feeBefore);

        assertEq(paidOut, amount, "value must be conserved on dispute resolution");
        assertEq(address(escrow).balance, 0);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Resolved));
    }
}
