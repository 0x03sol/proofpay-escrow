# ProofPay Web

The ProofPay interface: a docs-first overview and an invoice app that talks directly to the
deployed contracts on GIWA Sepolia. Built with Vite + React + TypeScript + viem.

## Design

Dark "ink ledger" surface, one verified-green accent (`#38E8A0`), amber for pending and red for
disputes. Data (addresses, amounts, hashes) is set in JetBrains Mono; headings in Space Grotesk.
The mark is a stamped seal, echoing Dojang (도장, "seal") which is what gates every payment.

## Run locally

```bash
npm install        # or: pnpm install
npm run dev        # dev server on http://localhost:5273
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

The deployed GIWA Sepolia addresses are baked into `src/lib/config.ts`, so the app works with no
environment configuration. Override via `VITE_*` vars (see `.env.example`) only if you redeploy.

## What it does

- Full wallet lifecycle via the injected EIP-1193 provider: connect, disconnect, silent
  reconnect, and live handling of `accountsChanged` / `chainChanged`, plus one-click switch/add
  of the GIWA Sepolia network.
- Reads invoices straight from chain (`InvoiceRegistry` + `ProofPayEscrow`) via multicall, and
  reads verification live from `DojangVerifier`.
- Merchant actions: create invoice (gated with a clear message if the wallet is not Dojang
  verified), cancel.
- Payer / merchant actions: fund escrow, release, refund, permissionless timeout refund, open
  dispute - each with live transaction status (confirm → mining → confirmed) and a clickable
  explorer link.

## Deploy to Vercel

The repo root `vercel.json` builds this app and serves it as an SPA:

```json
{ "buildCommand": "cd frontend && npm install && npm run build", "outputDirectory": "frontend/dist" }
```

Import the repo in Vercel and deploy. No environment variables are required.
