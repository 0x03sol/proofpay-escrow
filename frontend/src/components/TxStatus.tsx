import { Spinner, SealIcon } from './ui';
import type { TxState } from '../hooks/useTx';
import { explorerTx } from '../lib/config';
import { useI18n } from '../i18n';

export function TxStatus({ tx }: { tx: TxState }) {
  const { t } = useI18n();
  if (tx.phase === 'idle') return null;
  const tone = tx.phase === 'error' ? 'var(--dispute)' : tx.phase === 'success' ? 'var(--verified)' : 'var(--pending)';
  const label =
    tx.phase === 'signing' ? t('tx.signing') : tx.phase === 'mining' ? t('tx.mining') : tx.phase === 'success' ? t('tx.success') : t('tx.error');

  return (
    <div className="panel panel-pad" style={{ marginTop: 16, borderColor: `color-mix(in srgb, ${tone} 40%, var(--line))` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: tone, display: 'flex' }}>
          {tx.phase === 'signing' || tx.phase === 'mining' ? <Spinner /> : <SealIcon size={16} />}
        </span>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
      </div>
      {tx.hash && (
        <a className="mono" href={explorerTx(tx.hash)} target="_blank" rel="noreferrer" style={{ color: 'var(--text-dim)', fontSize: 12, display: 'inline-block', marginTop: 8 }}>
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
