<div align="center">

# ProofPay

**Non-custodial invoice escrow on GIWA, gated on real Dojang verified-address attestations.**

Pay a verified counterparty against a specific invoice. Funds sit in an on-chain escrow and are
released only when the buyer approves, refunded on a timeout, or split by a bounded arbitrator.

</div>

---

## Live on GIWA Sepolia (chain id 91342)

| Contract | Address | Deployment tx |
| --- | --- | --- |
| ProofPayEscrow | [`0xEA140bC5…65c26`](https://sepolia-explorer.giwa.io/address/0xEA140bC50D628A0eBacC8bc9d6998D6E5F265c26) | [tx](https://sepolia-explorer.giwa.io/tx/0x56aa5e3d001566e003957082957045f2fac429a822b4145c39d7369f7e3953fa) |
| InvoiceRegistry | [`0xff540b77…5eB9b1`](https://sepolia-explorer.giwa.io/address/0xff540b77a9710a470E356F499aF79fF94d5eB9b1) | [tx](https://sepolia-explorer.giwa.io/tx/0x3385f4fd056175c9e9fbc85abfba1ebd7ec1a1e56e560324679cabe84cbb6d33) |
| DisputeModule | [`0x9B3B6932…ced198`](https://sepolia-explorer.giwa.io/address/0x9B3B6932f67aBD3F67313fD8eB4c3F2E65ced198) | [tx](https://sepolia-explorer.giwa.io/tx/0x2f25c9a8c225f498dccc0b5230e21b702b1c188412047807e80bb331903b947c) |
| DojangVerifier | [`0x6c117CC7…Fab337`](https://sepolia-explorer.giwa.io/address/0x6c117CC7fA20356EAf426E6B3181211A9DFab337) | [tx](https://sepolia-explorer.giwa.io/tx/0xffd98c4aa56742e61fa890995999122c696ae487a40b31f93f1d749cc99ffdbe) |

Reads verification from GIWA's live [DojangScroll](https://sepolia-explorer.giwa.io/address/0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9) at `0xd5077b67…17B9`.

## How a payment works

1. A recipient with a live Dojang Verified Address attestation creates an invoice (amount, asset, refund window). Only a document hash goes on-chain.
2. The buyer funds the escrow. The merchant's verification is re-checked at funding time, not just at creation.
3. The buyer releases on delivery. If nothing happens, anyone can trigger a timeout refund to the buyer.
4. Either party can open a dispute, which locks the escrow until an arbitrator settles it with a payer/merchant split.

## How ProofPay uses GIWA

ProofPay is built around primitives that exist on GIWA specifically:

- **Dojang (EAS attestations).** Verification is read from the deployed `DojangScroll` read layer, which resolves a Verified Address attestation through the [Ethereum Attestation Service](https://sepolia-explorer.giwa.io/address/0x4200000000000000000000000000000000000021) predeploy and checks existence, expiry, and revocation. ProofPay never issues attestations; it only reads them, so the trusted issuer set can grow without touching escrow logic.
- **UP ID.** The `up.id` name attached to a verified wallet gives payers a human-readable, non-transferable identity for the recipient instead of a raw hex address.
- **OP Stack L2.** One-second blocks and low fees make frequent payment-state updates (fund, release, refund, dispute) cheap enough to be practical.
- **Flashblocks.** Around 200ms preconfirmations back a responsive payment-status UI, presented as preconfirmed and distinct from final settlement.

## Security model

- **Non-custodial.** There is no admin withdrawal path. Escrowed funds can only reach the invoice's payer, its merchant, or the fee recipient.
- **Fee capped in code.** The protocol fee is fixed at 0.5% and can never exceed 1%. It is taken from the merchant's proceeds, never added to a refund.
- **Bounded arbitration.** A dispute locks the escrow. The arbitrator can only split that one escrow between its real payer and merchant, never redirect funds elsewhere.
- **Buyer timeout protection.** Invoices can carry a refund window after which anyone can return the funds to the payer.

These invariants are covered by the contract test suite, including a fork test that runs the full lifecycle against the live GIWA Dojang stack with a genuinely attested merchant.

## Architecture

```
contracts/   Solidity (Foundry). Escrow, registry, verifier, dispute module + full test suite.
backend/     TypeScript event indexer and read API (viem + Fastify + SQLite).
frontend/    Vite + React + viem web app. Reads contracts directly; no backend required.
```

### Contracts

| Contract | Responsibility |
| --- | --- |
| `ProofPayEscrow` | Non-custodial custody and lifecycle: fund, release, merchant refund, timeout refund, dispute. Native ETH and whitelisted ERC-20. |
| `InvoiceRegistry` | Commercial records and status. Stores a document hash only. The escrow is the sole authority for lifecycle transitions. |
| `DojangVerifier` | Reads verification from `DojangScroll` for a configurable set of trusted attesters. |
| `DisputeModule` | Pluggable arbitration with evidence hashes and a bounded resolution split. |

### Frontend

- Full wallet lifecycle over the injected provider: connect, disconnect, silent reconnect, live `accountsChanged` and `chainChanged` handling, and one-click GIWA network switch/add.
- Reads invoices straight from chain via multicall and verification straight from `DojangVerifier`.
- Live transaction status (confirm, mining, confirmed) with a clickable explorer link on every action.
- Deployed addresses are compiled into the app, so the hosted site runs with no configuration.

## Build and test

Contracts:

```bash
cd contracts
forge test                                   # unit + fuzz suite
GIWA_RPC_URL=https://sepolia-rpc.giwa.io \
  forge test --match-path "test/fork/*"      # live integration against GIWA
```

Frontend:

```bash
cd frontend
npm install
npm run dev        # local development
npm run build      # production build to dist/
```

Backend indexer and API:

```bash
cd backend
pnpm install
pnpm start
```

## Deploy the contracts

```bash
cd contracts
cp .env.example .env      # add a funded GIWA Sepolia key; testnet ETH from https://faucet.giwa.io
forge script script/Deploy.s.sol:Deploy --rpc-url giwa_sepolia --broadcast --slow
```

## Deploy the site

The repository is Vercel-ready. The root `vercel.json` builds `frontend/` and serves it as a
single-page app. Import the repository in Vercel and deploy; no environment variables are required.

## Notes

ProofPay runs on GIWA Sepolia testnet. Do not send mainnet assets. On the live testnet, Verified
Address attestations are issued by Upbit Korea, so a merchant must hold a live attestation to create
or receive against an invoice. The full verified flow is exercised by the fork test in `contracts/`.
