import { createPublicClient, defineChain, http } from 'viem';
import { config } from './config.js';

export const giwaSepolia = defineChain({
  id: config.chainId,
  name: 'GIWA Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  blockExplorers: { default: { name: 'Blockscout', url: config.explorerUrl } },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: giwaSepolia,
  transport: http(config.rpcUrl),
});
