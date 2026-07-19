import type { Address } from 'viem';

const env = import.meta.env as Record<string, string | undefined>;

// Deployed on GIWA Sepolia (chainId 91342). Baked in so the hosted site works with no config.
export const CHAIN_ID = 91342;
export const RPC_URL = 'https://sepolia-rpc.giwa.io';
export const EXPLORER_URL = 'https://sepolia-explorer.giwa.io';
export const CHAIN_NAME = 'GIWA Sepolia';

export const ADDRESSES = {
  invoiceRegistry: (env.VITE_INVOICE_REGISTRY ?? '0xff540b77a9710a470E356F499aF79fF94d5eB9b1') as Address,
  proofPayEscrow: (env.VITE_PROOFPAY_ESCROW ?? '0xEA140bC50D628A0eBacC8bc9d6998D6E5F265c26') as Address,
  disputeModule: (env.VITE_DISPUTE_MODULE ?? '0x9B3B6932f67aBD3F67313fD8eB4c3F2E65ced198') as Address,
  dojangVerifier: (env.VITE_DOJANG_VERIFIER ?? '0x6c117CC7fA20356EAf426E6B3181211A9DFab337') as Address,
  dojangScroll: '0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9' as Address,
  multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11' as Address,
} as const;

// Optional indexer API. If reachable it powers the event timeline; the app also works without it.
export const API_URL = env.VITE_API_URL ?? '';

export const REPO_URL = 'https://github.com/0x03sol/proofpay-escrow';

export const FEE_BPS = 50; // 0.5%, matches the deployed escrow

export function explorerTx(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}
export function explorerAddr(addr: string): string {
  return `${EXPLORER_URL}/address/${addr}`;
}
