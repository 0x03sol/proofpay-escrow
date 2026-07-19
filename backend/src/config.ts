import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Address } from 'viem';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface DeploymentFile {
  chainId: number;
  deployedBlock: number;
  DojangVerifier: Address;
  InvoiceRegistry: Address;
  ProofPayEscrow: Address;
  DisputeModule: Address;
  DojangScroll: Address;
  feeBps: number;
}

const chainId = Number(process.env.CHAIN_ID ?? 91342);
const rpcUrl = process.env.GIWA_RPC_URL ?? 'https://sepolia-rpc.giwa.io';

const deploymentsPath =
  process.env.DEPLOYMENTS_PATH ??
  resolve(__dirname, '..', '..', 'contracts', 'deployments', `${chainId}.json`);

function loadDeployment(): DeploymentFile {
  try {
    const raw = readFileSync(deploymentsPath, 'utf8');
    return JSON.parse(raw) as DeploymentFile;
  } catch (err) {
    throw new Error(
      `Could not read deployment file at ${deploymentsPath}. ` +
        `Deploy the contracts first, or set DEPLOYMENTS_PATH / explicit address env vars. (${String(err)})`
    );
  }
}

const deployment = loadDeployment();

function addr(envKey: string, fallback: Address): Address {
  const v = process.env[envKey];
  return (v && v.length > 0 ? v : fallback) as Address;
}

export const config = {
  chainId,
  rpcUrl,
  explorerUrl: 'https://sepolia-explorer.giwa.io',
  dbPath: process.env.DB_PATH ?? './data/proofpay.db',
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? '0.0.0.0',
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 4000),
  logChunkSize: BigInt(process.env.LOG_CHUNK_SIZE ?? 5000),
  startBlock: BigInt(process.env.START_BLOCK ?? deployment.deployedBlock),
  indexerEnabled: (process.env.INDEXER_ENABLED ?? 'true') !== 'false',
  feeBps: deployment.feeBps,
  addresses: {
    invoiceRegistry: addr('INVOICE_REGISTRY', deployment.InvoiceRegistry),
    proofPayEscrow: addr('PROOFPAY_ESCROW', deployment.ProofPayEscrow),
    disputeModule: addr('DISPUTE_MODULE', deployment.DisputeModule),
    dojangVerifier: addr('DOJANG_VERIFIER', deployment.DojangVerifier),
    dojangScroll: deployment.DojangScroll,
  },
} as const;

export type Config = typeof config;
