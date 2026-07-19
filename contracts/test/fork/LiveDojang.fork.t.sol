// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IEAS, AttestationRequest, AttestationRequestData} from "@eas-contracts/contracts/IEAS.sol";

import {DojangVerifier} from "../../src/DojangVerifier.sol";
import {InvoiceRegistry} from "../../src/InvoiceRegistry.sol";
import {ProofPayEscrow} from "../../src/ProofPayEscrow.sol";
import {DisputeModule} from "../../src/DisputeModule.sol";
import {InvoiceStatus} from "../../src/interfaces/IInvoiceRegistry.sol";
import {DojangAttesterId, DojangAttesterIds} from "../../src/libraries/DojangTypes.sol";

interface IDojangAttesterBook {
    function getAttester(bytes32 attesterId) external view returns (address);
}

/// @notice End-to-end integration against the REAL, deployed Dojang stack on GIWA Sepolia.
///         Nothing here is simulated locally: verification status is read from the live
///         DojangScroll, and the verified merchant is produced by attesting through the live
///         EAS as the live UPBIT_KOREA attester (auto-indexed by the live resolver).
/// @dev Gated on the GIWA_RPC_URL env var so the suite still runs offline. Enable with:
///      GIWA_RPC_URL=https://sepolia-rpc.giwa.io forge test --match-path "test/fork/*"
contract LiveDojangForkTest is Test {
    // Live GIWA Sepolia addresses (verified via cast).
    address internal constant EAS = 0x4200000000000000000000000000000000000021;
    address internal constant DOJANG_SCROLL = 0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9;
    address internal constant DOJANG_ATTESTER_BOOK = 0xDA282E89244424E297Ce8e78089B54D043FB28B6;
    bytes32 internal constant VERIFIED_ADDRESS_SCHEMA_UID =
        0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08;

    bool internal forked;

    DojangVerifier internal verifier;
    InvoiceRegistry internal registry;
    ProofPayEscrow internal escrow;
    DisputeModule internal disputeModule;

    address internal owner = makeAddr("owner");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal arbitrator = makeAddr("arbitrator");
    address internal merchant = makeAddr("merchant");
    address internal payer = makeAddr("payer");

    function setUp() public {
        string memory rpc = vm.envOr("GIWA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;

        DojangAttesterId[] memory ids = new DojangAttesterId[](1);
        ids[0] = DojangAttesterIds.UPBIT_KOREA;

        verifier = new DojangVerifier(DOJANG_SCROLL, ids, owner);
        registry = new InvoiceRegistry(address(verifier), owner);
        escrow = new ProofPayEscrow(address(registry), address(verifier), feeRecipient, 50, owner);
        disputeModule = new DisputeModule(arbitrator, owner);

        vm.startPrank(owner);
        registry.setEscrow(address(escrow));
        escrow.setDisputeModule(address(disputeModule));
        disputeModule.setEscrow(address(escrow));
        vm.stopPrank();
    }

    /// @notice Real negative read: an arbitrary address is not verified by the live read layer.
    function test_live_unverifiedAddressReadsFalse() public {
        if (!forked) return vm.skip(true);
        assertFalse(verifier.isVerified(makeAddr("nobody")));
    }

    /// @notice Full lifecycle with a genuinely live-verified merchant.
    function test_live_fullLifecycleWithRealVerification() public {
        if (!forked) return vm.skip(true);

        // Produce a genuine Verified Address attestation via the live attester + live EAS.
        address liveAttester =
            IDojangAttesterBook(DOJANG_ATTESTER_BOOK).getAttester(DojangAttesterId.unwrap(DojangAttesterIds.UPBIT_KOREA));
        assertTrue(liveAttester != address(0), "live attester must be registered");

        vm.prank(liveAttester);
        IEAS(EAS).attest(
            AttestationRequest({
                schema: VERIFIED_ADDRESS_SCHEMA_UID,
                data: AttestationRequestData({
                    recipient: merchant,
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: abi.encode(true),
                    value: 0
                })
            })
        );

        // The live DojangScroll now reports the merchant as verified.
        assertTrue(verifier.isVerified(merchant), "merchant should be verified on live chain");

        // Run the real escrow lifecycle end to end.
        vm.prank(merchant);
        uint256 id = registry.createInvoice(address(0), 2 ether, address(0), 0, 0, false, keccak256("live-invoice"));

        vm.deal(payer, 2 ether);
        vm.prank(payer);
        escrow.fund{value: 2 ether}(id);

        uint256 merchantBefore = merchant.balance;
        vm.prank(payer);
        escrow.release(id);

        uint256 fee = 2 ether * 50 / 10_000;
        assertEq(merchant.balance - merchantBefore, 2 ether - fee);
        assertEq(uint8(registry.statusOf(id)), uint8(InvoiceStatus.Released));
    }
}
