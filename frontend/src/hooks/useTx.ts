import { useCallback, useState } from 'react';
import type { Hash } from 'viem';
import { publicClient } from '../lib/clients';

export type TxPhase = 'idle' | 'signing' | 'mining' | 'success' | 'error';

export interface TxState {
  phase: TxPhase;
  hash: Hash | null;
  error: string | null;
  busy: boolean;
  run: (build: () => Promise<Hash>) => Promise<boolean>;
  reset: () => void;
}

const PHASE_TEXT: Record<TxPhase, string> = {
  idle: '',
  signing: 'Confirm in your wallet',
  mining: 'Waiting for on-chain confirmation',
  success: 'Confirmed on GIWA',
  error: 'Transaction failed',
};

export function phaseText(p: TxPhase): string {
  return PHASE_TEXT[p];
}

/** Pull a short, human-readable reason out of viem / wallet errors. */
function shortenTxError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/MerchantNotVerified|0x64d9a9fa/i.test(raw)) {
    return 'MerchantNotVerified — wallet has no live Dojang Verified Address';
  }
  if (/PayerNotVerified/i.test(raw)) {
    return 'PayerNotVerified — payer must be Dojang verified for this invoice';
  }
  if (/User rejected|user rejected|denied/i.test(raw)) {
    return 'Rejected in wallet';
  }
  // viem often puts the useful line after "Details:" or "Reason:"
  const details = raw.match(/Details:\s*(.+)/i)?.[1] ?? raw.match(/reason:\s*(.+)/i)?.[1];
  const line = (details ?? raw.split('\n')[0]).trim();
  return line.slice(0, 220);
}

export function useTx(): TxState {
  const [phase, setPhase] = useState<TxPhase>('idle');
  const [hash, setHash] = useState<Hash | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setHash(null);
    setError(null);
  }, []);

  const run = useCallback(async (build: () => Promise<Hash>): Promise<boolean> => {
    setError(null);
    setHash(null);
    setPhase('signing');
    try {
      const h = await build();
      setHash(h);
      setPhase('mining');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: h });
      if (receipt.status === 'success') {
        setPhase('success');
        return true;
      }
      setPhase('error');
      setError('Reverted on-chain');
      return false;
    } catch (e) {
      setPhase('error');
      setError(shortenTxError(e));
      return false;
    }
  }, []);

  return { phase, hash, error, busy: phase === 'signing' || phase === 'mining', run, reset };
}
