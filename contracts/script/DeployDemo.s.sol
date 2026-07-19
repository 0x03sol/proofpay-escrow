// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {AlwaysVerifiedVerifier} from "../src/mocks/AlwaysVerifiedVerifier.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {ProofPayEscrow} from "../src/ProofPayEscrow.sol";
import {DisputeModule} from "../src/DisputeModule.sol";

/// @notice Deploys ProofPay on GIWA Sepolia with AlwaysVerifiedVerifier so create/fund/release
///         demos work without a live Upbit Dojang attestation.
///
/// Usage:
///   source .env
///   forge script script/DeployDemo.s.sol:DeployDemo \
///     --rpc-url giwa_sepolia --broadcast --slow -vvvv
contract DeployDemo is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        uint256 feeBps = vm.envOr("FEE_BPS", uint256(50));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        address arbitrator = vm.envOr("ARBITRATOR", deployer);

        vm.startBroadcast(pk);

        AlwaysVerifiedVerifier verifier = new AlwaysVerifiedVerifier();
        InvoiceRegistry registry = new InvoiceRegistry(address(verifier), deployer);
        ProofPayEscrow escrow = new ProofPayEscrow(address(registry), address(verifier), feeRecipient, feeBps, deployer);
        DisputeModule disputeModule = new DisputeModule(arbitrator, deployer);

        registry.setEscrow(address(escrow));
        // Keep merchant verification on — AlwaysVerified makes everyone pass.
        // registry.requireVerifiedMerchant stays true (constructor default).
        escrow.setDisputeModule(address(disputeModule));
        disputeModule.setEscrow(address(escrow));

        vm.stopBroadcast();

        console2.log("== ProofPay DEMO deploy chainId", block.chainid, "==");
        console2.log("AlwaysVerifiedVerifier", address(verifier));
        console2.log("InvoiceRegistry", address(registry));
        console2.log("ProofPayEscrow ", address(escrow));
        console2.log("DisputeModule  ", address(disputeModule));
        console2.log("feeBps         ", feeBps);

        string memory obj = "proofpay";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeUint(obj, "deployedBlock", block.number);
        vm.serializeAddress(obj, "DojangVerifier", address(verifier));
        vm.serializeAddress(obj, "InvoiceRegistry", address(registry));
        vm.serializeAddress(obj, "ProofPayEscrow", address(escrow));
        vm.serializeAddress(obj, "DojangScroll", address(0));
        vm.serializeUint(obj, "feeBps", feeBps);
        vm.serializeBool(obj, "demoVerifier", true);
        string memory out = vm.serializeAddress(obj, "DisputeModule", address(disputeModule));
        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
