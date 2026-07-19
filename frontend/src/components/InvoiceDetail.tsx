import { useCallback, useEffect, useState } from 'react';
import { Spinner, StatusBadge, VerifiedBadge, AddrLink } from './ui';
import { TxStatus } from './TxStatus';
import { useTx } from '../hooks/useTx';
import { walletClientFor } from '../lib/clients';
import { escrowAbi, registryAbi } from '../lib/abis';
import { ADDRESSES, FEE_BPS } from '../lib/config';
import { fetchInvoiceDetail, feeFor, type InvoiceDetail as Detail } from '../lib/data';
import { fmtEth, tokenLabel, fmtDate, isNative, ZERO } from '../lib/format';
import type { WalletState } from '../hooks/useWallet';

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0' }}>
      <span className="k" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)' }}>
        {k}
      </span>
      <span className="mono" style={{ fontSize: 14, textAlign: 'right' }}>{children}</span>
    </div>
  );
}

export function InvoiceDetail({ id, wallet, onBack }: { id: number; wallet: WalletState; onBack: () => void }) {
  const tx = useTx();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setD(await fetchInvoiceDetail(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !d) {
    return (
      <div className="panel panel-pad" style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-dim)' }}>
        <Spinner /> Loading invoice #{id}…
      </div>
    );
  }

  const inv = d.invoice;
  const me = wallet.account?.toLowerCase();
  const isPayer = !!me && d.escrow?.payer.toLowerCase() === me;
  const isMerchant = !!me && inv.merchant.toLowerCase() === me;
  const canFundAsMe = !!me && (inv.payer === ZERO || inv.payer.toLowerCase() === me);
  const native = isNative(inv.token);
  const now = Math.floor(Date.now() / 1000);
  const timedOut =
    d.escrow && inv.refundAfter > 0n && now >= Number(d.escrow.fundedAt) + Number(inv.refundAfter);
  const split = feeFor(inv.amount, FEE_BPS);

  const needWallet = !wallet.account || wallet.wrongChain;

  async function act(fn: () => Promise<`0x${string}`>) {
    const ok = await tx.run(fn);
    if (ok) await load();
  }
  const wc = () => walletClientFor(wallet.account!);

  const fund = () =>
    act(() =>
      wc().writeContract({
        address: ADDRESSES.proofPayEscrow,
        abi: escrowAbi,
        functionName: 'fund',
        args: [BigInt(id)],
        value: native ? inv.amount : 0n,
      })
    );
  const call = (functionName: 'release' | 'refundByMerchant' | 'refundExpired' | 'openDispute') => () =>
    act(() => wc().writeContract({ address: ADDRESSES.proofPayEscrow, abi: escrowAbi, functionName, args: [BigInt(id)] }));
  const cancel = () =>
    act(() => wc().writeContract({ address: ADDRESSES.invoiceRegistry, abi: registryAbi, functionName: 'cancelInvoice', args: [BigInt(id)] }));

  return (
    <div>
      <button className="btn btn-sm btn-ghost" onClick={onBack} style={{ marginBottom: 14 }}>
        ‹ All invoices
      </button>

      <div className="panel panel-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h2 style={{ fontSize: 28 }}>
              {fmtEth(inv.amount)} <span className="dim" style={{ fontSize: 18 }}>{tokenLabel(inv.token)}</span>
            </h2>
            <p className="faint mono" style={{ fontSize: 12, marginTop: 4 }}>Invoice #{inv.id}</p>
          </div>
          <StatusBadge status={inv.status} />
        </div>

        <hr className="divider" style={{ margin: '6px 0' }} />

        <Row k="Merchant">
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <AddrLink addr={inv.merchant} /> <VerifiedBadge verified={d.merchantVerified} label="verified" />
          </span>
        </Row>
        <Row k="Payer">
          {inv.payer === ZERO && !d.escrow ? <span className="faint">any payer</span> : <AddrLink addr={d.escrow?.payer ?? inv.payer} />}
        </Row>
        <Row k="Merchant receives">{fmtEth(split.merchant)} {tokenLabel(inv.token)}</Row>
        <Row k={`Protocol fee (${FEE_BPS / 100}%)`}>{fmtEth(split.fee)} {tokenLabel(inv.token)}</Row>
        <Row k="Created">{fmtDate(inv.createdAt)}</Row>
        {inv.refundAfter > 0n && d.escrow && (
          <Row k="Timeout refund at">{fmtDate(Number(d.escrow.fundedAt) + Number(inv.refundAfter))}</Row>
        )}
        {inv.requireVerifiedPayer && <Row k="Payer requirement">must be Dojang-verified</Row>}
        <Row k="Document hash"><span title={inv.documentHash}>{inv.documentHash.slice(0, 14)}…</span></Row>
      </div>

      {/* Actions */}
      <div className="panel panel-pad" style={{ marginTop: 14 }}>
        <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-dim)' }}>Actions</h4>

        {needWallet && <p className="dim" style={{ fontSize: 14 }}>Connect to GIWA Sepolia to act on this invoice.</p>}

        {!needWallet && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {inv.status === 1 && canFundAsMe && native && (
              <button className="btn btn-accent" onClick={fund} disabled={tx.busy}>
                Fund escrow · {fmtEth(inv.amount)} ETH
              </button>
            )}
            {inv.status === 1 && canFundAsMe && !native && (
              <p className="dim" style={{ fontSize: 13 }}>ERC-20 funding needs a token approval step; this demo uses native ETH invoices.</p>
            )}
            {inv.status === 1 && isMerchant && (
              <button className="btn btn-ghost" onClick={cancel} disabled={tx.busy}>Cancel invoice</button>
            )}

            {inv.status === 2 && !d.escrow?.disputed && (
              <>
                {isPayer && <button className="btn btn-accent" onClick={call('release')} disabled={tx.busy}>Release to merchant</button>}
                {isMerchant && <button className="btn" onClick={call('refundByMerchant')} disabled={tx.busy}>Refund the payer</button>}
                {timedOut && <button className="btn" onClick={call('refundExpired')} disabled={tx.busy}>Trigger timeout refund</button>}
                {(isPayer || isMerchant) && (
                  <button className="btn btn-danger" onClick={call('openDispute')} disabled={tx.busy}>Open dispute</button>
                )}
              </>
            )}

            {inv.status === 5 && <p className="dim" style={{ fontSize: 14 }}>Escrow is locked and awaiting arbitration.</p>}
            {(inv.status === 3 || inv.status === 4 || inv.status === 7 || inv.status === 6) && (
              <p className="dim" style={{ fontSize: 14 }}>This invoice is settled. No further actions.</p>
            )}
            {inv.status === 2 && !isPayer && !isMerchant && !timedOut && (
              <p className="dim" style={{ fontSize: 14 }}>Only the payer or merchant can act while funded.</p>
            )}
          </div>
        )}

        <TxStatus tx={tx} />
      </div>
    </div>
  );
}
