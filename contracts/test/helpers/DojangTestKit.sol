// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {EAS} from "@eas-contracts/contracts/EAS.sol";
import {SchemaRegistry} from "@eas-contracts/contracts/SchemaRegistry.sol";
import {ISchemaRegistry} from "@eas-contracts/contracts/ISchemaRegistry.sol";
import {ISchemaResolver} from "@eas-contracts/contracts/resolver/ISchemaResolver.sol";
import {
    AttestationRequest,
    AttestationRequestData,
    RevocationRequest,
    RevocationRequestData
} from "@eas-contracts/contracts/IEAS.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {SchemaBook} from "dojang/SchemaBook.sol";
import {DojangAttesterBook} from "dojang/DojangAttesterBook.sol";
import {AttestationIndexer} from "dojang/AttestationIndexer.sol";
import {DojangScroll} from "dojang/DojangScroll.sol";
import {AddressDojangResolver} from "dojang/AddressDojangResolver.sol";
import {DojangSchemaIds, DojangAttesterIds as RealAttesterIds} from "dojang/libraries/Types.sol";

/// @notice Deploys the genuine EAS + Dojang read-layer stack in-memory and issues real
///         Verified Address attestations. No behaviour is mocked: `isVerified` reflects an
///         actual EAS attestation that is really indexed and really revocable, exactly as
///         it works on GIWA. Address verification is produced by attesting through the real
///         EAS from a real allowlisted attester, which auto-indexes via the real resolver.
abstract contract DojangTestKit is Test {
    // GIWA/OP-Stack predeploy addresses the Dojang contracts reference as constants.
    address internal constant EAS_PREDEPLOY = 0x4200000000000000000000000000000000000021;
    address internal constant SCHEMA_REGISTRY_PREDEPLOY = 0x4200000000000000000000000000000000000020;

    EAS internal eas;
    SchemaRegistry internal schemaRegistry;
    AttestationIndexer internal attestationIndexer;
    AddressDojangResolver internal addressResolver;
    SchemaBook internal schemaBook;
    DojangAttesterBook internal attesterBook;
    DojangScroll internal dojangScroll;

    address internal upbitAttester = makeAddr("upbitKoreaAttester");
    bytes32 internal verifiedAddressSchemaUid;

    mapping(address => bytes32) internal _attestationOf;

    /// @notice Deploy and wire the full real stack. `admin` receives all admin roles.
    function _deployDojangStack(address admin) internal {
        // 1. Place a real SchemaRegistry and EAS at the predeploy addresses. EAS binds to the
        //    SchemaRegistry predeploy as an immutable, so both must live at their canonical slots.
        SchemaRegistry srImpl = new SchemaRegistry();
        vm.etch(SCHEMA_REGISTRY_PREDEPLOY, address(srImpl).code);
        schemaRegistry = SchemaRegistry(SCHEMA_REGISTRY_PREDEPLOY);

        EAS easImpl = new EAS(ISchemaRegistry(SCHEMA_REGISTRY_PREDEPLOY));
        vm.etch(EAS_PREDEPLOY, address(easImpl).code);
        eas = EAS(EAS_PREDEPLOY);

        // 2. Attestation indexer (UUPS proxy).
        AttestationIndexer indexerImpl = new AttestationIndexer();
        attestationIndexer = AttestationIndexer(
            address(new ERC1967Proxy(address(indexerImpl), abi.encodeCall(AttestationIndexer.initialize, (admin))))
        );

        // 3. Address resolver (UUPS proxy) that enforces the attester allowlist and auto-indexes.
        AddressDojangResolver resolverImpl = new AddressDojangResolver();
        addressResolver = AddressDojangResolver(
            payable(
                address(
                    new ERC1967Proxy(address(resolverImpl), abi.encodeCall(AddressDojangResolver.initialize, (admin)))
                )
            )
        );

        vm.startPrank(admin);
        addressResolver.setIndexer(address(attestationIndexer));
        addressResolver.allowAttester(upbitAttester);
        attestationIndexer.grantRole(attestationIndexer.INDEXER_ROLE(), address(addressResolver));
        vm.stopPrank();

        // 4. Register the Verified Address schema (`bool isVerified`) with the resolver.
        verifiedAddressSchemaUid = schemaRegistry.register("bool isVerified", ISchemaResolver(address(addressResolver)), true);

        // 5. Schema book maps the Dojang schema id to the concrete EAS schema uid.
        SchemaBook schemaBookImpl = new SchemaBook();
        schemaBook =
            SchemaBook(address(new ERC1967Proxy(address(schemaBookImpl), abi.encodeCall(SchemaBook.initialize, (admin)))));
        vm.prank(admin);
        schemaBook.register(DojangSchemaIds.ADDRESS_DOJANG, verifiedAddressSchemaUid);

        // 6. Attester book maps the UPBIT_KOREA id to the concrete attester address.
        DojangAttesterBook attesterBookImpl = new DojangAttesterBook();
        attesterBook = DojangAttesterBook(
            address(new ERC1967Proxy(address(attesterBookImpl), abi.encodeCall(DojangAttesterBook.initialize, (admin))))
        );
        vm.prank(admin);
        attesterBook.register(RealAttesterIds.UPBIT_KOREA, upbitAttester);

        // 7. DojangScroll read layer, wired to the above.
        DojangScroll scrollImpl = new DojangScroll();
        dojangScroll =
            DojangScroll(address(new ERC1967Proxy(address(scrollImpl), abi.encodeCall(DojangScroll.initialize, (admin)))));
        vm.startPrank(admin);
        dojangScroll.setSchemaBook(address(schemaBook));
        dojangScroll.setDojangAttesterBook(address(attesterBook));
        dojangScroll.setIndexer(address(attestationIndexer));
        vm.stopPrank();
    }

    /// @notice Issue a genuine Verified Address attestation for `who` (auto-indexed by the resolver).
    function _verifyAddress(address who) internal returns (bytes32 uid) {
        vm.prank(upbitAttester);
        uid = eas.attest(
            AttestationRequest({
                schema: verifiedAddressSchemaUid,
                data: AttestationRequestData({
                    recipient: who,
                    expirationTime: 0,
                    revocable: true,
                    refUID: bytes32(0),
                    data: abi.encode(true),
                    value: 0
                })
            })
        );
        _attestationOf[who] = uid;
    }

    /// @notice Genuinely revoke the previously issued attestation for `who`.
    function _revokeAddress(address who) internal {
        vm.prank(upbitAttester);
        eas.revoke(
            RevocationRequest({
                schema: verifiedAddressSchemaUid,
                data: RevocationRequestData({uid: _attestationOf[who], value: 0})
            })
        );
    }
}
