import { useCallback, useEffect, useState } from 'react';
import { numberToHex } from 'viem';
import { getInjected } from '../lib/clients';
import { CHAIN_ID, CHAIN_NAME, EXPLORER_URL, RPC_URL } from '../lib/config';

const STORAGE_KEY = 'proofpay.connected';

export interface WalletState {
  account: `0x${string}` | null;
  chainId: number | null;
  isConnecting: boolean;
  hasWallet: boolean;
  wrongChain: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  error: string | null;
}

export function useWallet(): WalletState {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasWallet = typeof window !== 'undefined' && !!getInjected();

  const refreshChain = useCallback(async () => {
    const p = getInjected();
    if (!p) return;
    const hex = (await p.request({ method: 'eth_chainId' })) as string;
    setChainId(parseInt(hex, 16));
  }, []);

  const connect = useCallback(async () => {
    const p = getInjected();
    if (!p) {
      setError('No wallet detected. Install MetaMask or another EVM wallet.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[];
      if (accounts[0]) {
        setAccount(accounts[0] as `0x${string}`);
        localStorage.setItem(STORAGE_KEY, '1');
      }
      await refreshChain();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, [refreshChain]);

  const disconnect = useCallback(() => {
    setAccount(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const switchChain = useCallback(async () => {
    const p = getInjected();
    if (!p) return;
    const hexId = numberToHex(CHAIN_ID);
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
    } catch (e) {
      // 4902 = chain not added
      if ((e as { code?: number }).code === 4902) {
        await p.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: hexId,
              chainName: CHAIN_NAME,
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [EXPLORER_URL],
            },
          ],
        });
      }
    }
    await refreshChain();
  }, [refreshChain]);

  // Reconnect silently if previously connected; wire lifecycle events.
  useEffect(() => {
    const p = getInjected();
    if (!p) return;

    if (localStorage.getItem(STORAGE_KEY) === '1') {
      void p.request({ method: 'eth_accounts' }).then((accs) => {
        const list = accs as string[];
        if (list[0]) setAccount(list[0] as `0x${string}`);
      });
      void refreshChain();
    }

    const onAccounts = (accs: unknown) => {
      const list = accs as string[];
      if (!list || list.length === 0) {
        disconnect();
      } else {
        setAccount(list[0] as `0x${string}`);
      }
    };
    const onChain = (hex: unknown) => setChainId(parseInt(hex as string, 16));

    const anyP = p as unknown as {
      on: (e: string, h: (a: unknown) => void) => void;
      removeListener: (e: string, h: (a: unknown) => void) => void;
    };
    anyP.on('accountsChanged', onAccounts);
    anyP.on('chainChanged', onChain);
    return () => {
      anyP.removeListener('accountsChanged', onAccounts);
      anyP.removeListener('chainChanged', onChain);
    };
  }, [disconnect, refreshChain]);

  return {
    account,
    chainId,
    isConnecting,
    hasWallet,
    wrongChain: account !== null && chainId !== null && chainId !== CHAIN_ID,
    connect,
    disconnect,
    switchChain,
    error,
  };
}
