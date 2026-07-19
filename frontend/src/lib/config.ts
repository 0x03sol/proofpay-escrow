import type { Address } from 'viem';

const env = import.meta.env as Record<string, string | undefined>;

// Deployed on GIWA Sepolia (chainId 91342). Baked in so the hosted site works with no config.
export const CHAIN_ID = 91342;
export const RPC_URL = 'https://sepolia-rpc.giwa.io';
export const EXPLORER_URL = 'https://sepolia-explorer.giwa.io';
export const CHAIN_NAME = 'GIWA Sepolia';

// Demo stack on GIWA Sepolia (AlwaysVerifiedVerifier) so create → fund → release works
// without a live Upbit Dojang attestation. Override via VITE_* for production deploys.
export const ADDRESSES = {
  invoiceRegistry: (env.VITE_INVOICE_REGISTRY ?? '0x9A778D36Ad2cb48Ca27a54Ff102E405F23c9A231') as Address,
  proofPayEscrow: (env.VITE_PROOFPAY_ESCROW ?? '0x8117cfa450B85Fceeac2B2e57855a2cea9a84953') as Address,
  disputeModule: (env.VITE_DISPUTE_MODULE ?? '0x42eE8bacF973dCAdfB4B1fE6C6AAF2454875D8da') as Address,
  dojangVerifier: (env.VITE_DOJANG_VERIFIER ?? '0x12ADaE62CC2941639bFB5276B68076f549Dd6EDA') as Address,
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
