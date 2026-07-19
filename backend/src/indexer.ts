import type { Log } from 'viem';
import { publicClient } from './chain.js';
import { config } from './config.js';
import { invoiceRegistryAbi, proofPayEscrowAbi, disputeModuleAbi } from './abis.js';
import * as store from './db.js';

const REGISTRY = config.addresses.invoiceRegistry.toLowerCase();
const ESCROW = config.addresses.proofPayEscrow.toLowerCase();
const DISPUTE = config.addresses.disputeModule.toLowerCase();

const addresses = [config.addresses.invoiceRegistry, config.addresses.proofPayEscrow, config.addresses.disputeModule];

const eventAbis = [
  ...invoiceRegistryAbi.filter((x) => x.type === 'event'),
  ...proofPayEscrowAbi.filter((x) => x.type === 'event'),
  ...disputeModuleAbi.filter((x) => x.type === 'event'),
];

function contractName(address: string): string {
  const a = address.toLowerCase();
  if (a === REGISTRY) return 'InvoiceRegistry';
  if (a === ESCROW) return 'ProofPayEscrow';
  if (a === DISPUTE) return 'DisputeModule';
  return 'Unknown';
}

/** Recursively stringify bigints so decoded args are JSON/DB-safe. */
function serializeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    out[k] = typeof v === 'bigint' ? v.toString() : v;
  }
  return out;
}

const blockTsCache = new Map<bigint, number>();

async function warmBlockTimestamps(blocks: bigint[]): Promise<void> {
  for (const bn of blocks) {
    if (blockTsCache.has(bn)) continue;
    const b = await publicClient.getBlock({ blockNumber: bn });
    blockTsCache.set(bn, Number(b.timestamp));
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyLog(log: any): void {
  const name = log.eventName as string;
  const contract = contractName(log.address as string);
  const args = (log.args ?? {}) as Record<string, unknown>;
  const invoiceId = Number((args.invoiceId ?? args.id) as bigint);
  const block = Number(log.blockNumber as bigint);
  const ts = blockTsCache.get(log.blockNumber as bigint) ?? 0;

  store.insertEvent({
    invoice_id: invoiceId,
    kind: name,
    contract,
    args: serializeArgs(args),
    block_number: block,
    log_index: Number(log.logIndex),
    tx_hash: log.transactionHash as string,
    ts,
  });

  if (contract === 'InvoiceRegistry') {
    if (name === 'InvoiceCreated') {
      store.insertInvoiceCreated({
        id: invoiceId,
        merchant: String(args.merchant),
        token: String(args.token),
        amount: String(args.amount),
        document_hash: String(args.documentHash),
        created_block: block,
        created_tx: log.transactionHash as string,
        created_at: ts,
      });
    } else if (name === 'InvoiceStatusChanged') {
      store.setInvoiceStatus(invoiceId, Number(args.status as number), block);
    }
  } else if (contract === 'ProofPayEscrow') {
    if (name === 'PaymentReceived') {
      store.setInvoicePayer(invoiceId, String(args.payer), block);
    }
  }
}

async function processRange(fromBlock: bigint, toBlock: bigint): Promise<void> {
  const logs = (await publicClient.getLogs({
    address: addresses,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: eventAbis as any,
    fromBlock,
    toBlock,
  })) as Log[];

  if (logs.length > 0) {
    logs.sort((a, b) =>
      a.blockNumber === b.blockNumber
        ? Number(a.logIndex) - Number(b.logIndex)
        : Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n))
    );
    await warmBlockTimestamps([...new Set(logs.map((l) => l.blockNumber as bigint))]);
  }

  store.runBatch(() => {
    for (const log of logs) applyLog(log);
    store.setCursor(toBlock);
  });

  if (logs.length > 0) {
    console.log(`[indexer] ${fromBlock}-${toBlock}: ${logs.length} log(s)`);
  }
}

/** Index from the cursor up to the current head, in chunks. Returns the head block. */
export async function catchUp(): Promise<bigint> {
  const head = await publicClient.getBlockNumber();
  let from = store.getCursor() + 1n;
  if (from > head) return head;

  while (from <= head) {
    const to = from + config.logChunkSize - 1n > head ? head : from + config.logChunkSize - 1n;
    await processRange(from, to);
    from = to + 1n;
  }
  return head;
}

let running = false;

export async function start(): Promise<void> {
  if (running) return;
  running = true;
  console.log(
    `[indexer] starting on chain ${config.chainId} from block ${store.getCursor() + 1n} ` +
      `(registry=${config.addresses.invoiceRegistry}, escrow=${config.addresses.proofPayEscrow})`
  );

  const loop = async (): Promise<void> => {
    while (running) {
      try {
        await catchUp();
      } catch (err) {
        console.error('[indexer] error:', err instanceof Error ? err.message : err);
      }
      await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    }
  };
  void loop();
}

export function stop(): void {
  running = false;
}
