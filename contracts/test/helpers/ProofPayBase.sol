// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DojangTestKit} from "./DojangTestKit.sol";
import {TestERC20} from "./TestERC20.sol";

import {DojangVerifier} from "../../src/DojangVerifier.sol";
import {InvoiceRegistry} from "../../src/InvoiceRegistry.sol";
import {ProofPayEscrow} from "../../src/ProofPayEscrow.sol";
import {DisputeModule} from "../../src/DisputeModule.sol";
import {DojangAttesterId, DojangAttesterIds} from "../../src/libraries/DojangTypes.sol";

/// @notice Full ProofPay system wired on top of the genuine Dojang stack, plus shared actors
///         and helpers used across the test suite.
abstract contract ProofPayBase is DojangTestKit {
    // Actors
    address internal owner = makeAddr("owner");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal arbitrator = makeAddr("arbitrator");
    address internal merchant = makeAddr("merchant");
    address internal payer = makeAddr("payer");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant DEFAULT_FEE_BPS = 50; // 0.5%
    address internal constant NATIVE = address(0);

    // System under test
    DojangVerifier internal verifier;
    InvoiceRegistry internal registry;
    ProofPayEscrow internal escrow;
    DisputeModule internal disputeModule;
    TestERC20 internal token;

    function setUp() public virtual {
        _deployDojangStack(owner);

        DojangAttesterId[] memory ids = new DojangAttesterId[](1);
        ids[0] = DojangAttesterIds.UPBIT_KOREA;

        verifier = new DojangVerifier(address(dojangScroll), ids, owner);
        registry = new InvoiceRegistry(address(verifier), owner);
        escrow = new ProofPayEscrow(address(registry), address(verifier), feeRecipient, DEFAULT_FEE_BPS, owner);
        disputeModule = new DisputeModule(arbitrator, owner);

        vm.startPrank(owner);
        registry.setEscrow(address(escrow));
        escrow.setDisputeModule(address(disputeModule));
        disputeModule.setEscrow(address(escrow));
        vm.stopPrank();

        token = new TestERC20("Test USD", "tUSD", 6);

        // Merchant is a verified Korean business by default in the happy path.
        _verifyAddress(merchant);
    }

    // ----- helpers -----

    function _createNativeInvoice(uint256 amount) internal returns (uint256 id) {
        vm.prank(merchant);
        id = registry.createInvoice(NATIVE, amount, address(0), 0, 0, false, keccak256("doc"));
    }

    function _createNativeInvoice(uint256 amount, address expectedPayer, uint64 fundBy, uint64 refundAfter, bool requireVerifiedPayer)
        internal
        returns (uint256 id)
    {
        vm.prank(merchant);
        id = registry.createInvoice(NATIVE, amount, expectedPayer, fundBy, refundAfter, requireVerifiedPayer, keccak256("doc"));
    }

    function _createTokenInvoice(uint256 amount) internal returns (uint256 id) {
        vm.prank(merchant);
        id = registry.createInvoice(address(token), amount, address(0), 0, 0, false, keccak256("doc"));
    }

    function _fundNative(uint256 id, address from, uint256 amount) internal {
        vm.deal(from, amount);
        vm.prank(from);
        escrow.fund{value: amount}(id);
    }
}
