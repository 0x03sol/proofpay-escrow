import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id            INTEGER PRIMARY KEY,
    merchant      TEXT NOT NULL,
    token         TEXT NOT NULL,
    amount        TEXT NOT NULL,
    document_hash TEXT NOT NULL,
    status        INTEGER NOT NULL,
    payer         TEXT,
    created_block INTEGER NOT NULL,
    created_tx    TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    updated_block INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_invoices_merchant ON invoices(merchant);
  CREATE INDEX IF NOT EXISTS idx_invoices_payer    ON invoices(payer);
  CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status);

  CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id   INTEGER NOT NULL,
    kind         TEXT NOT NULL,
    contract     TEXT NOT NULL,
    args         TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    log_index    INTEGER NOT NULL,
    tx_hash      TEXT NOT NULL,
    ts           INTEGER NOT NULL,
    UNIQUE(tx_hash, log_index)
  );
  CREATE INDEX IF NOT EXISTS idx_events_invoice ON events(invoice_id);
`);

// ---- cursor ----
const _getMeta = db.prepare('SELECT value FROM meta WHERE key = ?');
const _setMeta = db.prepare(
  'INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

export function getCursor(): bigint {
  const row = _getMeta.get('last_indexed_block') as { value: string } | undefined;
  return row ? BigInt(row.value) : config.startBlock - 1n;
}
export function setCursor(block: bigint): void {
  _setMeta.run('last_indexed_block', block.toString());
}

// ---- invoices ----
const _insertInvoice = db.prepare(`
  INSERT INTO invoices(id, merchant, token, amount, document_hash, status, payer, created_block, created_tx, created_at, updated_block)
  VALUES($id, $merchant, $token, $amount, $document_hash, $status, NULL, $created_block, $created_tx, $created_at, $updated_block)
  ON CONFLICT(id) DO NOTHING
`);
const _setStatus = db.prepare('UPDATE invoices SET status = $status, updated_block = $block WHERE id = $id');
const _setPayer = db.prepare('UPDATE invoices SET payer = $payer, updated_block = $block WHERE id = $id');

export interface InvoiceCreatedInput {
  id: number;
  merchant: string;
  token: string;
  amount: string;
  document_hash: string;
  created_block: number;
  created_tx: string;
  created_at: number;
}

export function insertInvoiceCreated(inv: InvoiceCreatedInput): void {
  _insertInvoice.run({ ...inv, status: 1 /* Open */, updated_block: inv.created_block });
}
export function setInvoiceStatus(id: number, status: number, block: number): void {
  _setStatus.run({ id, status, block });
}
export function setInvoicePayer(id: number, payer: string, block: number): void {
  _setPayer.run({ id, payer, block });
}

// ---- events ----
const _insertEvent = db.prepare(`
  INSERT INTO events(invoice_id, kind, contract, args, block_number, log_index, tx_hash, ts)
  VALUES($invoice_id, $kind, $contract, $args, $block_number, $log_index, $tx_hash, $ts)
  ON CONFLICT(tx_hash, log_index) DO NOTHING
`);

export interface EventInput {
  invoice_id: number;
  kind: string;
  contract: string;
  args: Record<string, unknown>;
  block_number: number;
  log_index: number;
  tx_hash: string;
  ts: number;
}

export function insertEvent(e: EventInput): void {
  _insertEvent.run({
    invoice_id: e.invoice_id,
    kind: e.kind,
    contract: e.contract,
    args: JSON.stringify(e.args),
    block_number: e.block_number,
    log_index: e.log_index,
    tx_hash: e.tx_hash,
    ts: e.ts,
  });
}

/// Apply a set of writes atomically.
export function runBatch(fn: () => void): void {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---- queries (API) ----
export interface InvoiceRow {
  id: number;
  merchant: string;
  token: string;
  amount: string;
  document_hash: string;
  status: number;
  payer: string | null;
  created_block: number;
  created_tx: string;
  created_at: number;
  updated_block: number;
}

export function listInvoices(filters: {
  merchant?: string;
  payer?: string;
  status?: number;
  limit: number;
  offset: number;
}): InvoiceRow[] {
  const clauses: string[] = [];
  const params: Record<string, string | number> = { limit: filters.limit, offset: filters.offset };
  if (filters.merchant) {
    clauses.push('merchant = $merchant COLLATE NOCASE');
    params.merchant = filters.merchant;
  }
  if (filters.payer) {
    clauses.push('payer = $payer COLLATE NOCASE');
    params.payer = filters.payer;
  }
  if (filters.status !== undefined) {
    clauses.push('status = $status');
    params.status = filters.status;
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM invoices ${where} ORDER BY id DESC LIMIT $limit OFFSET $offset`)
    .all(params) as unknown as InvoiceRow[];
}

export function getInvoiceRow(id: number): InvoiceRow | undefined {
  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as unknown as InvoiceRow | undefined;
}

export function getInvoiceEvents(id: number): unknown[] {
  const rows = db
    .prepare(
      'SELECT kind, contract, args, block_number, log_index, tx_hash, ts FROM events WHERE invoice_id = ? ORDER BY block_number ASC, log_index ASC'
    )
    .all(id) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ ...r, args: JSON.parse(r.args as string) }));
}

export function stats(): { invoices: number; byStatus: Record<string, number> } {
  const total = (db.prepare('SELECT COUNT(*) AS c FROM invoices').get() as { c: number }).c;
  const rows = db.prepare('SELECT status, COUNT(*) AS c FROM invoices GROUP BY status').all() as Array<{
    status: number;
    c: number;
  }>;
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[String(r.status)] = r.c;
  return { invoices: total, byStatus };
}
