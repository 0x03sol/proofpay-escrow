import { useCallback, useEffect, useState } from 'react';
import { InvoicesList } from '../components/InvoicesList';
import { CreateInvoice } from '../components/CreateInvoice';
import { InvoiceDetail } from '../components/InvoiceDetail';
import { fetchInvoices, type InvoiceRecord } from '../lib/data';
import type { WalletState } from '../hooks/useWallet';

export function AppView({ wallet }: { wallet: WalletState }) {
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
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  if (selected !== null) {
    return (
      <main className="shell" style={{ padding: '32px 0 64px', maxWidth: 820 }}>
        <InvoiceDetail id={selected} wallet={wallet} onBack={() => { setSelected(null); void load(); }} />
      </main>
    );
  }

  return (
    <main className="shell" style={{ padding: '32px 0 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Invoices</h1>
          <p className="dim" style={{ fontSize: 14, marginTop: 4 }}>
            Read live from the ProofPay contracts on GIWA Sepolia.
          </p>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => void load()}>Refresh</button>
      </div>

      <div className="grid-2">
        <InvoicesList invoices={invoices} loading={loading} onOpen={setSelected} />
        <CreateInvoice wallet={wallet} onCreated={load} />
      </div>
    </main>
  );
}
