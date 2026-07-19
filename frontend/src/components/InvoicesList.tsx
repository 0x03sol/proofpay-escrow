import { StatusBadge, Spinner } from './ui';
import type { InvoiceRecord } from '../lib/data';
import { fmtEth, tokenLabel, shortAddr } from '../lib/format';
import { useI18n } from '../i18n';

export function InvoicesList({
  invoices,
  loading,
  onOpen,
}: {
  invoices: InvoiceRecord[];
  loading: boolean;
  onOpen: (id: number) => void;
}) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="panel panel-pad" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-dim)' }}>
        <Spinner /> {t('app.loading')}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="panel panel-pad" style={{ textAlign: 'center', padding: '56px 24px' }}>
        <h4 style={{ fontSize: 18, marginBottom: 8 }}>{t('app.empty.t')}</h4>
        <p className="dim" style={{ fontSize: 15, maxWidth: 460, margin: '0 auto' }}>{t('app.empty.b')}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {invoices.map((inv) => (
        <div key={inv.id} className="rowcard" style={{ gridTemplateColumns: '64px 1.2fr 1fr auto', cursor: 'pointer' }} onClick={() => onOpen(inv.id)}>
          <div className="kv">
            <span className="k">{t('list.invoice')}</span>
            <span className="v">#{inv.id}</span>
          </div>
          <div className="kv">
            <span className="k">{t('list.merchant')}</span>
            <span className="v">{shortAddr(inv.merchant)}</span>
          </div>
          <div className="kv">
            <span className="k">{t('list.amount')}</span>
            <span className="v">{fmtEth(inv.amount)} {tokenLabel(inv.token)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge status={inv.status} />
            <span className="faint">›</span>
          </div>
        </div>
      ))}
    </div>
  );
}
