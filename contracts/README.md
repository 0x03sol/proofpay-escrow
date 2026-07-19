# ProofPay Contracts

Non-custodial, invoice-backed escrow for GIWA, gated on real Dojang verified-address
attestations. Built with Foundry, Solidity 0.8.28.

## Architecture

| Contract | Responsibility |
| --- | --- |
| `DojangVerifier` | Identity adapter over GIWA's live **DojangScroll** read layer. Reads Verified Address attestations for a configurable set of trusted attesters (default: `UPBIT_KOREA`). Issues nothing; holds no funds. |
| `InvoiceRegistry` | Commercial record layer. Stores invoice terms and a document **hash** (never PII). Merchants create/cancel; the escrow is the sole authority for funding-lifecycle status. |
| `ProofPayEscrow` | Non-custodial funds custody + lifecycle: `fund → release / refundByMerchant / refundExpired / dispute`. Handles native ETH and whitelisted ERC-20s. Capped protocol fee (≤ 1%). |
| `DisputeModule` | Pluggable arbitration. Records evidence hashes; a configurable arbitrator resolves a disputed escrow with a payer/merchant basis-points split. |

`PaymentRouter` from the design doc is intentionally **not** a separate contract: asset routing
(native + ERC-20 via `SafeERC20`) is handled inside `ProofPayEscrow`, avoiding a pass-through
contract that would only add gas and trust surface.

### Non-custodial guarantee

The owner has **no** function that can move, seize, or redirect escrowed funds. Every payout
goes only to the invoice's payer, its merchant, or the fee recipient (fee ≤ `MAX_FEE_BPS` = 1%).
Dispute resolution is delegated to the dispute module, whose arbitrator can only choose how a
single escrow splits between that escrow's real payer and merchant. Verified by
`test_nonCustodial_ownerCannotMoveFunds`.

## Dojang integration (real, not mocked)

`DojangVerifier` calls `DojangScroll.isVerified(address, attesterId)` on the official read layer:

- Live GIWA Sepolia DojangScroll: `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9` (v0.5.1)
- Verified Address schema UID: `0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08`
- `UPBIT_KOREA` attester id: `0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034`

## Testing

No behaviour is mocked. Local tests deploy the **genuine** EAS + Dojang read stack
(SchemaRegistry/EAS etched to their predeploys, plus real SchemaBook, DojangAttesterBook,
AttestationIndexer, AddressDojangResolver and DojangScroll behind UUPS proxies) and issue real,
indexed, revocable attestations. Fork tests run the full lifecycle against the **live** chain.

```bash
forge test                                   # unit + fuzz (fork tests skip if no RPC)
GIWA_RPC_URL=https://sepolia-rpc.giwa.io \
  forge test --match-path "test/fork/*" -vvv # live integration
```

## Deploy to GIWA Sepolia

```bash
cp .env.example .env      # then add your funded PRIVATE_KEY
source .env
forge script script/Deploy.s.sol:Deploy --rpc-url giwa_sepolia --broadcast --slow -vvvv
```

Deployed addresses are written to `deployments/<chainId>.json` (chainId 91342).
Fund the deployer at https://faucet.giwa.io.
