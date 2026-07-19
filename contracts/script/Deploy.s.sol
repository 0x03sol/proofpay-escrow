// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {DojangVerifier} from "../src/DojangVerifier.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {ProofPayEscrow} from "../src/ProofPayEscrow.sol";
import {DisputeModule} from "../src/DisputeModule.sol";
import {DojangAttesterId, DojangAttesterIds} from "../src/libraries/DojangTypes.sol";

/// @notice Deploys and wires the ProofPay system on GIWA Sepolia.
///
/// Required env:
///   PRIVATE_KEY        Deployer key (hex, with 0x). Never commit this.
/// Optional env (sensible defaults shown):
///   DOJANG_SCROLL      Live DojangScroll read layer (default: GIWA Sepolia deployment)
///   FEE_BPS            Protocol fee in basis points, <= 100 (default: 50 = 0.5%)
///   FEE_RECIPIENT      Fee recipient (default: deployer)
///   ARBITRATOR         Dispute arbitrator (default: deployer)
///   PROOFPAY_OWNER     Final owner of all contracts (default: deployer)
///
/// Usage:
///   source .env
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url giwa_sepolia --broadcast --slow -vvvv
contract Deploy is Script {
    /// @dev Live DojangScroll on GIWA Sepolia (verified on-chain, v0.5.1).
    address internal constant DEFAULT_DOJANG_SCROLL = 0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        address scroll = vm.envOr("DOJANG_SCROLL", DEFAULT_DOJANG_SCROLL);
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(50));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address arbitrator = vm.envOr("ARBITRATOR", deployer);
        address finalOwner = vm.envOr("PROOFPAY_OWNER", deployer);

        DojangAttesterId[] memory ids = new DojangAttesterId[](1);
        ids[0] = DojangAttesterIds.UPBIT_KOREA;

        vm.startBroadcast(pk);

        // Deploy with the deployer as owner so wiring can be done atomically.
        DojangVerifier verifier = new DojangVerifier(scroll, ids, deployer);
        InvoiceRegistry registry = new InvoiceRegistry(address(verifier), deployer);
        ProofPayEscrow escrow = new ProofPayEscrow(address(registry), address(verifier), feeRecipient, feeBps, deployer);
        DisputeModule disputeModule = new DisputeModule(arbitrator, deployer);

        // Wire the system.
        registry.setEscrow(address(escrow));
        escrow.setDisputeModule(address(disputeModule));
        disputeModule.setEscrow(address(escrow));

        // Hand ownership to the intended owner (Ownable2Step: owner must acceptOwnership()).
        if (finalOwner != deployer) {
            verifier.transferOwnership(finalOwner);
            registry.transferOwnership(finalOwner);
            escrow.transferOwnership(finalOwner);
            disputeModule.transferOwnership(finalOwner);
        }

        vm.stopBroadcast();

        console2.log("== ProofPay deployed on chainId", block.chainid, "==");
        console2.log("DojangVerifier ", address(verifier));
        console2.log("InvoiceRegistry", address(registry));
        console2.log("ProofPayEscrow ", address(escrow));
        console2.log("DisputeModule  ", address(disputeModule));
        console2.log("DojangScroll   ", scroll);
        console2.log("feeRecipient   ", feeRecipient);
        console2.log("arbitrator     ", arbitrator);
        console2.log("feeBps         ", feeBps);
        console2.log("owner (pending if != deployer)", finalOwner);

        _persist(address(verifier), address(registry), address(escrow), address(disputeModule), scroll, feeBps);
    }

    function _persist(
        address verifier,
        address registry,
        address escrow,
        address disputeModule,
        address scroll,
        uint256 feeBps
    ) internal {
        string memory obj = "proofpay";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "deployedBlock", block.number);
        vm.serializeAddress(obj, "DojangVerifier", verifier);
        vm.serializeAddress(obj, "InvoiceRegistry", registry);
        vm.serializeAddress(obj, "ProofPayEscrow", escrow);
        vm.serializeAddress(obj, "DojangScroll", scroll);
        vm.serializeUint(obj, "feeBps", feeBps);
        string memory out = vm.serializeAddress(obj, "DisputeModule", disputeModule);

        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
