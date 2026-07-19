import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { isAddress, getAddress } from 'viem';
import { config } from './config.js';
import { publicClient } from './chain.js';
import { proofPayEscrowAbi, dojangVerifierAbi, INVOICE_STATUS } from './abis.js';
import * as store from './db.js';

function statusName(s: number): string {
  return INVOICE_STATUS[s] ?? `Unknown(${s})`;
}

function serializeInvoice(row: store.InvoiceRow) {
  return {
    id: row.id,
    merchant: row.merchant,
    token: row.token,
    isNativeEth: row.token === '0x0000000000000000000000000000000000000000',
    amount: row.amount,
    documentHash: row.document_hash,
    status: row.status,
    statusName: statusName(row.status),
    payer: row.payer,
    createdBlock: row.created_block,
    createdTx: row.created_tx,
    createdAt: row.created_at,
    updatedBlock: row.updated_block,
    explorerTx: `${config.explorerUrl}/tx/${row.created_tx}`,
  };
}

async function liveVerified(account: string): Promise<boolean> {
  return (await publicClient.readContract({
    address: config.addresses.dojangVerifier,
    abi: dojangVerifierAbi,
    functionName: 'isVerified',
    args: [account as `0x${string}`],
  })) as boolean;
}

export async function buildApi(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  app.get('/health', async () => {
    const head = await publicClient.getBlockNumber();
    return {
      ok: true,
      chainId: config.chainId,
      lastIndexedBlock: store.getCursor().toString(),
      headBlock: head.toString(),
      behind: (head - store.getCursor()).toString(),
    };
  });

  app.get('/config', async () => ({
    chainId: config.chainId,
    explorerUrl: config.explorerUrl,
    feeBps: config.feeBps,
    addresses: config.addresses,
  }));

  app.get('/stats', async () => {
    const s = store.stats();
    const byStatusName: Record<string, number> = {};
    for (const [k, v] of Object.entries(s.byStatus)) byStatusName[statusName(Number(k))] = v;
    return { invoices: s.invoices, byStatus: byStatusName };
  });

  // List invoices with optional filters.
  app.get('/invoices', async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const limit = Math.min(Number(q.limit ?? 50), 200);
    const offset = Math.max(Number(q.offset ?? 0), 0);

    let status: number | undefined;
    if (q.status !== undefined) {
      const idx = INVOICE_STATUS.indexOf(q.status as (typeof INVOICE_STATUS)[number]);
      status = idx >= 0 ? idx : Number(q.status);
    }
    const rows = store.listInvoices({
      merchant: q.merchant && isAddress(q.merchant) ? getAddress(q.merchant) : undefined,
      payer: q.payer && isAddress(q.payer) ? getAddress(q.payer) : undefined,
      status,
      limit,
      offset,
    });
    return { invoices: rows.map(serializeInvoice), limit, offset };
  });

  // Invoice detail, enriched with the live escrow state and merchant verification.
  app.get('/invoices/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const row = store.getInvoiceRow(id);
    if (!row) return reply.code(404).send({ error: 'invoice not found' });

    const [escrowRes, merchantVerified] = await Promise.all([
      publicClient
        .readContract({
          address: config.addresses.proofPayEscrow,
          abi: proofPayEscrowAbi,
          functionName: 'getEscrow',
          args: [BigInt(id)],
        })
        .catch(() => null),
      liveVerified(row.merchant).catch(() => false),
    ]);

    let escrow: { payer: string; fundedAt: number; disputed: boolean; amount: string } | null = null;
    if (escrowRes) {
      const [p, fundedAt, disputed, amount] = escrowRes as [string, bigint, boolean, bigint];
      escrow = { payer: p, fundedAt: Number(fundedAt), disputed, amount: amount.toString() };
    }

    return {
      ...serializeInvoice(row),
      merchantVerifiedNow: merchantVerified,
      escrow,
      events: store.getInvoiceEvents(id),
    };
  });

  app.get('/invoices/:id/events', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!store.getInvoiceRow(id)) return reply.code(404).send({ error: 'invoice not found' });
    return { events: store.getInvoiceEvents(id) };
  });

  // Merchant view: live verification status + their invoices.
  app.get('/merchants/:address', async (req, reply) => {
    const address = (req.params as { address: string }).address;
    if (!isAddress(address)) return reply.code(400).send({ error: 'invalid address' });
    const checksummed = getAddress(address);
    const verified = await liveVerified(checksummed).catch(() => false);
    const invoices = store.listInvoices({ merchant: checksummed, limit: 200, offset: 0 });
    return { address: checksummed, verified, invoices: invoices.map(serializeInvoice) };
  });

  return app;
}
