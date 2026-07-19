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

export function CreateInvoice({ wallet, onCreated }: { wallet: WalletState; onCreated: () => void }) {
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
        <h3 style={{ fontSize: 17, marginBottom: 8 }}>Create an invoice</h3>
        <p className="dim" style={{ fontSize: 14 }}>Connect a wallet to issue an invoice.</p>
      </div>
    );
  }

  if (wallet.wrongChain) {
    return (
      <div className="panel panel-pad">
        <h3 style={{ fontSize: 17, marginBottom: 8 }}>Create an invoice</h3>
        <p className="dim" style={{ fontSize: 14, marginBottom: 12 }}>Switch to GIWA Sepolia to continue.</p>
        <button className="btn btn-accent" onClick={() => void wallet.switchChain()}>Switch network</button>
      </div>
    );
  }

  async function submit() {
    setFormErr(null);
    let value: bigint;
    try {
      value = parseEther(amount || '0');
    } catch {
      setFormErr('Enter a valid ETH amount');
      return;
    }
    if (value <= 0n) return setFormErr('Amount must be greater than zero');
    if (payer && !isAddress(payer)) return setFormErr('Expected payer is not a valid address');

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 17 }}>Create an invoice</h3>
        {verified !== null && <VerifiedBadge verified={verified} />}
      </div>

      {verified === false && (
        <div
          className="panel-pad"
          style={{ background: 'var(--bg-raise)', borderRadius: 8, border: '1px solid var(--line)', marginBottom: 16 }}
        >
          <p className="dim" style={{ fontSize: 13.5 }}>
            This wallet has no live Dojang Verified Address attestation, so the registry will reject an invoice from it.
            On GIWA Sepolia these attestations are issued by Upbit Korea. The full verified flow is covered by the
            contract test suite against the live Dojang stack.
          </p>
        </div>
      )}

      <Field label="Amount (ETH)" hint="Held in escrow until you release, refund, or a dispute resolves.">
        <input className="input" inputMode="decimal" placeholder="0.05" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>

      <Field label="Invoice reference" hint="Hashed on-chain (keccak256). The text itself never leaves your browser.">
        <input className="input" placeholder="INV-2026-014 / order id" value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>

      <Field label="Expected payer (optional)" hint="Leave blank to allow any payer.">
        <input className="input" placeholder="0x…" value={payer} onChange={(e) => setPayer(e.target.value)} />
      </Field>

      <Field label="Timeout refund window (hours)" hint="After this passes with no release, anyone can refund the payer. 0 disables it.">
        <input className="input" inputMode="numeric" value={refundHours} onChange={(e) => setRefundHours(e.target.value)} />
      </Field>

      <label style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 14, color: 'var(--text-dim)', marginBottom: 16, cursor: 'pointer' }}>
        <input type="checkbox" checked={requirePayer} onChange={(e) => setRequirePayer(e.target.checked)} />
        Require the payer to also be Dojang-verified
      </label>

      {formErr && <p className="mono" style={{ color: 'var(--dispute)', fontSize: 12, marginBottom: 12 }}>{formErr}</p>}

      <button className="btn btn-accent" style={{ width: '100%' }} disabled={tx.busy} onClick={() => void submit()}>
        {tx.busy ? <Spinner /> : null}
        {tx.busy ? 'Submitting' : 'Create invoice'}
      </button>

      <TxStatus tx={tx} />
    </div>
  );
}
