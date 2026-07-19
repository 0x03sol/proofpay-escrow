// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ProofPayBase} from "./helpers/ProofPayBase.sol";
import {ProofPayEscrow} from "../src/ProofPayEscrow.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {InvoiceStatus} from "../src/interfaces/IInvoiceRegistry.sol";

/// @notice A merchant contract that tries to re-enter the escrow when it receives ETH.
contract ReentrantMerchant {
    ProofPayEscrow public immutable escrow;
    uint256 public target;
    bool public attacked;

    constructor(ProofPayEscrow escrow_) {
        escrow = escrow_;
    }

    function setTarget(uint256 id) external {
        target = id;
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            // Attempt to re-enter a fund-moving path during payout.
            escrow.refundByMerchant(target);
        }
    }
}

contract ReentrancyTest is ProofPayBase {
    ReentrantMerchant internal evilMerchant;

    function setUp() public override {
        super.setUp();
        evilMerchant = new ReentrantMerchant(escrow);
        // The malicious merchant must itself be Dojang-verified to create invoices.
        _verifyAddress(address(evilMerchant));
    }

    function test_reentrancy_onReleaseIsBlocked() public {
        uint256 amount = 4 ether;
        vm.prank(address(evilMerchant));
        uint256 id = registry.createInvoice(NATIVE, amount, address(0), 0, 0, false, keccak256("doc"));
        evilMerchant.setTarget(id);

        _fundNative(id, payer, amount);

        // On release, the escrow pushes ETH to the merchant contract, whose receive() tries
        // to re-enter refundByMerchant. The reentrancy guard + state deletion must defeat it,
        // so the whole release reverts rather than double-spending.
        vm.prank(payer);
        vm.expectRevert();
        escrow.release(id);

        // Escrow funds remain intact; nothing was drained.
        assertEq(address(escrow).balance, amount);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Funded));
    }
}
