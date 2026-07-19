import { useEffect, useState } from 'react';
import { keccak256, parseEther, stringToHex, isAddress } from 'viem';
import { Field, VerifiedBadge, Spinner } from './ui';
import { TxStatus } from './TxStatus';
import { useTx } from '../hooks/useTx';
import { walletClientFor } from '../lib/clients';
import { registryAbi } from '../lib/abis';
import { ADDRESSES } from '../lib/config';
import { isVerified } from '../lib/data';
import { ZERO } from '../lib/format';
import type { WalletState } from '../hooks/useWallet';
import { useI18n } from '../i18n';

export function CreateInvoice({ wallet, onCreated }: { wallet: WalletState; onCreated: () => void }) {
  const { t } = useI18n();
  const tx = useTx();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [payer, setPayer] = useState('');
  const [refundHours, setRefundHours] = useState('72');
  const [requirePayer, setRequirePayer] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (wallet.account && !wallet.wrongChain) {
      setVerified(null);
      void isVerified(wallet.account).then((v) => live && setVerified(v)).catch(() => live && setVerified(false));
    } else {
      setVerified(null);
    }
    return () => {
      live = false;
    };
  }, [wallet.account, wallet.wrongChain]);

  if (!wallet.account) {
    return (
      <div className="panel panel-pad">
        <h3 style={{ fontSize: 19, marginBottom: 8 }}>{t('create.title')}</h3>
        <p className="dim" style={{ fontSize: 15 }}>{t('create.connect')}</p>
      </div>
    );
  }

  if (wallet.wrongChain) {
    return (
      <div className="panel panel-pad">
        <h3 style={{ fontSize: 19, marginBottom: 8 }}>{t('create.title')}</h3>
        <p className="dim" style={{ fontSize: 15, marginBottom: 14 }}>{t('create.switch')}</p>
        <button className="btn btn-accent" onClick={() => void wallet.switchChain()}>{t('wallet.switch')}</button>
      </div>
    );
  }

  async function submit() {
    setFormErr(null);
    let value: bigint;
    try {
      value = parseEther(amount || '0');
    } catch {
      setFormErr(t('create.err.amount'));
      return;
    }
    if (value <= 0n) return setFormErr(t('create.err.positive'));
    if (payer && !isAddress(payer)) return setFormErr(t('create.err.payer'));

    const documentHash = keccak256(stringToHex(reference || `proofpay:${Date.now()}`));
    const refundAfter = BigInt(Math.max(0, Math.floor(Number(refundHours) || 0)) * 3600);

    const wc = walletClientFor(wallet.account!);
    const ok = await tx.run(() =>
      wc.writeContract({
        address: ADDRESSES.invoiceRegistry,
        abi: registryAbi,
        functionName: 'createInvoice',
        args: [ZERO, value, (payer || ZERO) as `0x${string}`, 0n, refundAfter, requirePayer, documentHash],
      })
    );
    if (ok) {
      setAmount('');
      setReference('');
      setPayer('');
      onCreated();
    }
  }

  return (
    <div className="panel panel-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 19 }}>{t('create.title')}</h3>
        {verified !== null && <VerifiedBadge verified={verified} />}
      </div>

      {verified === false && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--line)', padding: 16, marginBottom: 18 }}>
          <p className="dim" style={{ fontSize: 14 }}>{t('create.gate')}</p>
        </div>
      )}

      <Field label={t('create.amount')} hint={t('create.amount.hint')}>
        <input className="input" inputMode="decimal" placeholder="0.05" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>

      <Field label={t('create.ref')} hint={t('create.ref.hint')}>
        <input className="input" placeholder="INV-2026-014" value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>

      <Field label={t('create.payer')} hint={t('create.payer.hint')}>
        <input className="input" placeholder="0x…" value={payer} onChange={(e) => setPayer(e.target.value)} />
      </Field>

      <Field label={t('create.window')} hint={t('create.window.hint')}>
        <input className="input" inputMode="numeric" value={refundHours} onChange={(e) => setRefundHours(e.target.value)} />
      </Field>

      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: 'var(--text-dim)', marginBottom: 18, cursor: 'pointer' }}>
        <input type="checkbox" checked={requirePayer} onChange={(e) => setRequirePayer(e.target.checked)} />
        {t('create.requirePayer')}
      </label>

      {formErr && <p className="mono" style={{ color: 'var(--dispute)', fontSize: 13, marginBottom: 14 }}>{formErr}</p>}

      <button className="btn btn-accent" style={{ width: '100%' }} disabled={tx.busy} onClick={() => void submit()}>
        {tx.busy ? <Spinner /> : null}
        {tx.busy ? t('create.submitting') : t('create.submit')}
      </button>

      <TxStatus tx={tx} />
    </div>
  );
}
