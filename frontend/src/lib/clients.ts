import { createPublicClient, createWalletClient, custom, defineChain, http, type EIP1193Provider } from 'viem';
import { ADDRESSES, CHAIN_ID, CHAIN_NAME, EXPLORER_URL, RPC_URL } from './config';

export const giwaSepolia = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Blockscout', url: EXPLORER_URL } },
  contracts: { multicall3: { address: ADDRESSES.multicall3 } },
  testnet: true,
});

export const publicClient = createPublicClient({ chain: giwaSepolia, transport: http(RPC_URL) });

export function getInjected(): EIP1193Provider | undefined {
  return (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
}

export function walletClientFor(account: `0x${string}`) {
  const provider = getInjected();
  if (!provider) throw new Error('No injected wallet found');
  return createWalletClient({ account, chain: giwaSepolia, transport: custom(provider) });
}
