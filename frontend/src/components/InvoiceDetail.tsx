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
import { useI18n } from '../i18n';

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
  const { t } = useI18n();
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
        <Spinner /> {t('detail.loading')} #{id}…
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
        ‹ {t('detail.back')}
      </button>

      <div className="panel panel-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <h2 style={{ fontSize: 28 }}>
              {fmtEth(inv.amount)} <span className="dim" style={{ fontSize: 18 }}>{tokenLabel(inv.token)}</span>
            </h2>
            <p className="faint mono" style={{ fontSize: 12, marginTop: 4 }}>
              {t('detail.invoice')} #{inv.id}
            </p>
          </div>
          <StatusBadge status={inv.status} />
        </div>

        <hr className="divider" style={{ margin: '6px 0' }} />

        <Row k={t('detail.merchant')}>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <AddrLink addr={inv.merchant} />{' '}
            <VerifiedBadge verified={d.merchantVerified} label={t('status.verified')} />
          </span>
        </Row>
        <Row k={t('detail.payer')}>
          {d.escrow ? (
            <AddrLink addr={d.escrow.payer} />
          ) : inv.payer === ZERO ? (
            <span className="faint">{t('detail.anyPayer')}</span>
          ) : (
            <AddrLink addr={inv.payer} />
          )}
        </Row>
        <Row k={t('detail.receives')}>
          {fmtEth(split.merchant)} {tokenLabel(inv.token)}
        </Row>
        <Row k={`${t('detail.fee')} (${FEE_BPS / 100}%)`}>
          {fmtEth(split.fee)} {tokenLabel(inv.token)}
        </Row>
        <Row k={t('detail.created')}>{fmtDate(inv.createdAt)}</Row>
        {inv.refundAfter > 0n && !d.escrow && (
          <Row k={t('detail.refundWindow')}>
            {t('detail.refundWindowVal').replace('{h}', String(Number(inv.refundAfter) / 3600))}
          </Row>
        )}
        {inv.refundAfter > 0n && d.escrow && (
          <Row k={t('detail.timeoutAt')}>{fmtDate(Number(d.escrow.fundedAt) + Number(inv.refundAfter))}</Row>
        )}
        {inv.requireVerifiedPayer && <Row k={t('detail.payerReq')}>{t('detail.payerReqVal')}</Row>}
        <Row k={t('detail.docHash')}>
          <span title={inv.documentHash}>{inv.documentHash.slice(0, 14)}…</span>
        </Row>
      </div>

      <div className="panel panel-pad" style={{ marginTop: 14 }}>
        <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-dim)' }}>{t('detail.actions')}</h4>

        {needWallet && <p className="dim" style={{ fontSize: 14 }}>{t('detail.connectToAct')}</p>}

        {!needWallet && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {inv.status === 1 && canFundAsMe && native && !d.merchantVerified && (
              <p className="dim" style={{ fontSize: 14, width: '100%' }}>{t('detail.fundBlocked')}</p>
            )}
            {inv.status === 1 && canFundAsMe && native && (
              <button className="btn btn-accent" onClick={fund} disabled={tx.busy || !d.merchantVerified}>
                {t('detail.fund')} · {fmtEth(inv.amount)} ETH
              </button>
            )}
            {inv.status === 1 && canFundAsMe && !native && (
              <p className="dim" style={{ fontSize: 13 }}>{t('detail.erc20note')}</p>
            )}
            {inv.status === 1 && isMerchant && (
              <button className="btn btn-ghost" onClick={cancel} disabled={tx.busy}>
                {t('detail.cancel')}
              </button>
            )}

            {inv.status === 2 && !d.escrow?.disputed && (
              <>
                {isPayer && (
                  <button className="btn btn-accent" onClick={call('release')} disabled={tx.busy}>
                    {t('detail.release')}
                  </button>
                )}
                {isMerchant && (
                  <button className="btn" onClick={call('refundByMerchant')} disabled={tx.busy}>
                    {t('detail.refund')}
                  </button>
                )}
                {timedOut && (
                  <button className="btn" onClick={call('refundExpired')} disabled={tx.busy}>
                    {t('detail.timeout')}
                  </button>
                )}
                {(isPayer || isMerchant) && (
                  <button className="btn btn-danger" onClick={call('openDispute')} disabled={tx.busy}>
                    {t('detail.dispute')}
                  </button>
                )}
              </>
            )}

            {inv.status === 5 && <p className="dim" style={{ fontSize: 14 }}>{t('detail.locked')}</p>}
            {(inv.status === 3 || inv.status === 4 || inv.status === 7 || inv.status === 6) && (
              <p className="dim" style={{ fontSize: 14 }}>{t('detail.settled')}</p>
            )}
            {inv.status === 2 && !isPayer && !isMerchant && !timedOut && (
              <p className="dim" style={{ fontSize: 14 }}>{t('detail.onlyParties')}</p>
            )}
          </div>
        )}

        <TxStatus tx={tx} />
      </div>
    </div>
  );
}
