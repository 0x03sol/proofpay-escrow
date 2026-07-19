import { useCallback, useEffect, useState } from 'react';
import { InvoicesList } from '../components/InvoicesList';
import { CreateInvoice } from '../components/CreateInvoice';
import { InvoiceDetail } from '../components/InvoiceDetail';
import { fetchInvoices, type InvoiceRecord } from '../lib/data';
import type { WalletState } from '../hooks/useWallet';
import { useI18n } from '../i18n';

export function AppView({ wallet }: { wallet: WalletState }) {
  const { t } = useI18n();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setInvoices(await fetchInvoices());
    } catch {
      /* transient RPC errors are retried by the poll */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  if (selected !== null) {
    return (
      <main className="shell" style={{ padding: '40px 0 80px', maxWidth: 820 }}>
        <InvoiceDetail id={selected} wallet={wallet} onBack={() => { setSelected(null); void load(); }} />
      </main>
    );
  }

  return (
    <main className="shell" style={{ padding: '40px 0 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>{t('app.title')}</h1>
          <p className="dim" style={{ fontSize: 16, marginTop: 6 }}>{t('app.sub')}</p>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => void load()}>{t('app.refresh')}</button>
      </div>

      <div className="grid-2">
        <InvoicesList invoices={invoices} loading={loading} onOpen={setSelected} />
        <CreateInvoice wallet={wallet} onCreated={load} />
      </div>
    </main>
  );
}
