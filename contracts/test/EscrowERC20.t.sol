// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ProofPayBase} from "./helpers/ProofPayBase.sol";
import {ProofPayEscrow} from "../src/ProofPayEscrow.sol";
import {InvoiceStatus} from "../src/interfaces/IInvoiceRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EscrowERC20Test is ProofPayBase {
    uint256 internal constant AMOUNT = 5_000e6; // 5,000 tUSD (6 decimals)

    function _allowAndMint() internal {
        vm.prank(owner);
        escrow.setTokenAllowed(address(token), true);
        token.mint(payer, AMOUNT);
    }

    function test_fund_revertsWhenTokenNotAllowed() public {
        uint256 id = _createTokenInvoice(AMOUNT);
        token.mint(payer, AMOUNT);
        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        vm.expectRevert(abi.encodeWithSelector(ProofPayEscrow.TokenNotAllowed.selector, address(token)));
        escrow.fund(id);
        vm.stopPrank();
    }

    function test_fundAndRelease_transfersTokens() public {
        _allowAndMint();
        uint256 id = _createTokenInvoice(AMOUNT);

        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        escrow.fund(id);
        vm.stopPrank();

        assertEq(token.balanceOf(address(escrow)), AMOUNT);

        uint256 fee = AMOUNT * DEFAULT_FEE_BPS / 10_000;
        vm.prank(payer);
        escrow.release(id);

        assertEq(token.balanceOf(merchant), AMOUNT - fee);
        assertEq(token.balanceOf(feeRecipient), fee);
        assertEq(token.balanceOf(address(escrow)), 0);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Released));
    }

    function test_fund_revertsIfNativeValueSentForTokenInvoice() public {
        _allowAndMint();
        uint256 id = _createTokenInvoice(AMOUNT);
        vm.deal(payer, 1 ether);
        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        vm.expectRevert(ProofPayEscrow.UnexpectedNativeValue.selector);
        escrow.fund{value: 1 ether}(id);
        vm.stopPrank();
    }

    function test_refundByMerchant_returnsTokens() public {
        _allowAndMint();
        uint256 id = _createTokenInvoice(AMOUNT);
        vm.startPrank(payer);
        token.approve(address(escrow), AMOUNT);
        escrow.fund(id);
        vm.stopPrank();

        vm.prank(merchant);
        escrow.refundByMerchant(id);
        assertEq(token.balanceOf(payer), AMOUNT);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Refunded));
    }

    function test_setTokenAllowed_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        escrow.setTokenAllowed(address(token), true);
    }

    function test_nativeAlwaysAllowed() public view {
        assertTrue(escrow.isTokenAllowed(NATIVE));
    }
}
