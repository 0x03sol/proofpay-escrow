import { StatusBadge, AddrLink, Spinner } from './ui';
import type { InvoiceRecord } from '../lib/data';
import { fmtEth, tokenLabel, shortAddr } from '../lib/format';

export function InvoicesList({
  invoices,
  loading,
  onOpen,
}: {
  invoices: InvoiceRecord[];
  loading: boolean;
  onOpen: (id: number) => void;
}) {
  if (loading) {
    return (
      <div className="panel panel-pad" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-dim)' }}>
        <Spinner /> Reading invoices from GIWA…
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="panel panel-pad" style={{ textAlign: 'center', padding: '48px 20px' }}>
        <h4 style={{ fontSize: 16, marginBottom: 6 }}>No invoices yet</h4>
        <p className="dim" style={{ fontSize: 14, maxWidth: 460, margin: '0 auto' }}>
          This is the real on-chain state, not a placeholder. A verified merchant can create the first invoice from the
          panel on the right.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="rowcard"
          style={{ gridTemplateColumns: '64px 1.2fr 1fr auto', cursor: 'pointer' }}
          onClick={() => onOpen(inv.id)}
        >
          <div className="kv">
            <span className="k">Invoice</span>
            <span className="v">#{inv.id}</span>
          </div>
          <div className="kv">
            <span className="k">Merchant</span>
            <span className="v">{shortAddr(inv.merchant)}</span>
          </div>
          <div className="kv">
            <span className="k">Amount</span>
            <span className="v">
              {fmtEth(inv.amount)} {tokenLabel(inv.token)}
            </span>
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

export { AddrLink };
