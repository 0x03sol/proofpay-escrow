# ProofPay Backend - Indexer + Read API

A resumable event indexer and read-only REST API for the deployed ProofPay contracts on
GIWA Sepolia. All data is sourced from the chain - nothing is mocked. Contract addresses are
read from `../contracts/deployments/<chainId>.json` (written by the deploy script).

## Stack

- **viem** - chain reads and log fetching against `https://sepolia-rpc.giwa.io`
- **node:sqlite** - built-in SQLite persistence (no native build step). Postgres is the
  intended production target; the DB layer in `src/db.ts` is the only thing to swap.
- **fastify** - HTTP API

## Run

```bash
cp .env.example .env      # defaults already point at the live deployment
pnpm install
pnpm backfill             # one-shot: index from the deploy block to head
pnpm start                # API + continuous indexer (PORT default 8899)
```

## Indexer

`src/indexer.ts` fetches logs for the InvoiceRegistry, ProofPayEscrow and DisputeModule in
block chunks, decodes them, and writes invoices + an append-only event log inside a single
SQLite transaction. A cursor (`meta.last_indexed_block`) makes it resumable and idempotent
(`UNIQUE(tx_hash, log_index)`). Indexed events:

`InvoiceCreated`, `InvoiceStatusChanged`, `InvoiceCancelled`, `PaymentReceived`,
`EscrowReleased`, `RefundExecuted`, `DisputeOpened`, `DisputeResolved`, `DisputeRegistered`,
`EvidenceSubmitted`.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Indexer lag vs chain head |
| GET | `/config` | Chain id, fee, deployed addresses |
| GET | `/stats` | Invoice counts by status |
| GET | `/invoices?merchant=&payer=&status=&limit=&offset=` | List invoices |
| GET | `/invoices/:id` | Invoice + **live** escrow state + **live** merchant verification + event timeline |
| GET | `/invoices/:id/events` | Event timeline |
| GET | `/merchants/:address` | **Live** Dojang verification status + the merchant's invoices |

`/invoices/:id` and `/merchants/:address` enrich stored data with live `readContract` calls
(`ProofPayEscrow.getEscrow`, `DojangVerifier.isVerified`), so verification and custody state
are always current.

## Security

The API is read-only and serves public on-chain data. It binds `0.0.0.0` by default for VPS
access and has **no authentication** - place it behind a reverse proxy / firewall and add auth
before any non-public use.
