// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ProofPayBase} from "./helpers/ProofPayBase.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {Invoice, InvoiceStatus} from "../src/interfaces/IInvoiceRegistry.sol";

contract InvoiceRegistryTest is ProofPayBase {
    function test_createInvoice_byVerifiedMerchant() public {
        uint256 id = _createNativeInvoice(1 ether);
        assertEq(id, 1);
        assertEq(registry.invoiceCount(), 1);

        Invoice memory inv = registry.getInvoice(id);
        assertEq(inv.merchant, merchant);
        assertEq(inv.token, NATIVE);
        assertEq(inv.amount, 1 ether);
        assertEq(uint8(inv.status), uint8(InvoiceStatus.Open));
    }

    function test_createInvoice_revertsForUnverifiedMerchant() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(InvoiceRegistry.MerchantNotVerified.selector, stranger));
        registry.createInvoice(NATIVE, 1 ether, address(0), 0, 0, false, keccak256("doc"));
    }

    function test_createInvoice_allowsUnverifiedWhenRequirementDisabled() public {
        vm.prank(owner);
        registry.setRequireVerifiedMerchant(false);

        vm.prank(stranger);
        uint256 id = registry.createInvoice(NATIVE, 1 ether, address(0), 0, 0, false, keccak256("doc"));
        assertEq(registry.getInvoice(id).merchant, stranger);
    }

    function test_createInvoice_revertsOnZeroAmount() public {
        vm.prank(merchant);
        vm.expectRevert(InvoiceRegistry.InvalidAmount.selector);
        registry.createInvoice(NATIVE, 0, address(0), 0, 0, false, keccak256("doc"));
    }

    function test_cancelInvoice_byMerchantWhileOpen() public {
        uint256 id = _createNativeInvoice(1 ether);
        vm.prank(merchant);
        registry.cancelInvoice(id);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Cancelled));
    }

    function test_cancelInvoice_revertsForNonMerchant() public {
        uint256 id = _createNativeInvoice(1 ether);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(InvoiceRegistry.NotInvoiceMerchant.selector, id));
        registry.cancelInvoice(id);
    }

    function test_cancelInvoice_revertsAfterFunded() public {
        uint256 id = _createNativeInvoice(1 ether);
        _fundNative(id, payer, 1 ether);
        vm.prank(merchant);
        vm.expectRevert(
            abi.encodeWithSelector(
                InvoiceRegistry.InvalidStatusTransition.selector, id, InvoiceStatus.Funded, InvoiceStatus.Cancelled
            )
        );
        registry.cancelInvoice(id);
    }

    function test_statusTransitions_onlyEscrow() public {
        uint256 id = _createNativeInvoice(1 ether);
        vm.prank(stranger);
        vm.expectRevert(InvoiceRegistry.OnlyEscrow.selector);
        registry.onFunded(id, payer);
    }

    function test_getInvoice_revertsForUnknownId() public {
        vm.expectRevert(abi.encodeWithSelector(InvoiceRegistry.InvoiceNotFound.selector, uint256(999)));
        registry.getInvoice(999);
    }

    function test_setEscrow_onlyOnce() public {
        vm.prank(owner);
        vm.expectRevert(InvoiceRegistry.EscrowAlreadySet.selector);
        registry.setEscrow(address(0xBEEF));
    }
}
