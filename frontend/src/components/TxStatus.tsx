import { Spinner, SealIcon } from './ui';
import { phaseText, type TxState } from '../hooks/useTx';
import { explorerTx } from '../lib/config';

export function TxStatus({ tx }: { tx: TxState }) {
  if (tx.phase === 'idle') return null;
  const tone = tx.phase === 'error' ? 'var(--dispute)' : tx.phase === 'success' ? 'var(--verified)' : 'var(--pending)';

  return (
    <div
      className="panel panel-pad"
      style={{ marginTop: 14, borderColor: `color-mix(in srgb, ${tone} 40%, var(--line))` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: tone, display: 'flex' }}>
          {tx.phase === 'signing' || tx.phase === 'mining' ? <Spinner /> : <SealIcon size={16} />}
        </span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{phaseText(tx.phase)}</span>
      </div>
      {tx.hash && (
        <a
          className="mono"
          href={explorerTx(tx.hash)}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--text-dim)', fontSize: 12, display: 'inline-block', marginTop: 8 }}
        >
          {tx.hash.slice(0, 18)}… ↗
        </a>
      )}
      {tx.error && (
        <p className="mono" style={{ color: 'var(--dispute)', fontSize: 12, marginTop: 8 }}>
          {tx.error}
        </p>
      )}
    </div>
  );
}
