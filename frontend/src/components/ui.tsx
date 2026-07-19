import type { ReactNode } from 'react';
import { INVOICE_STATUS } from '../lib/abis';
import { statusTone, shortAddr } from '../lib/format';
import { explorerAddr } from '../lib/config';

export function StatusBadge({ status }: { status: number }) {
  const tone = statusTone(status);
  return (
    <span className={`badge ${tone}`}>
      <span className="dot" />
      {INVOICE_STATUS[status] ?? 'Unknown'}
    </span>
  );
}

export function VerifiedBadge({ verified, label = 'Dojang verified' }: { verified: boolean; label?: string }) {
  return verified ? (
    <span className="badge verified" title="Verified Address attestation is live on Dojang">
      <SealIcon /> {label}
    </span>
  ) : (
    <span className="badge neutral" title="No live Verified Address attestation">
      <span className="dot" /> unverified
    </span>
  );
}

export function AddrLink({ addr }: { addr: string }) {
  return (
    <a className="mono" href={explorerAddr(addr)} target="_blank" rel="noreferrer" style={{ color: 'var(--text-dim)' }}>
      {shortAddr(addr)}
    </a>
  );
}

export function Spinner({ size = 15 }: { size?: number }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function SealIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 12.5L10 16.5L18 8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 1.5A10.5 10.5 0 0 0 8.68 22c.52.1.71-.23.71-.5v-1.94c-2.92.64-3.54-1.25-3.54-1.25-.48-1.21-1.17-1.53-1.17-1.53-.95-.65.07-.64.07-.64 1.06.07 1.61 1.09 1.61 1.09.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.19 0-1.15.41-2.08 1.08-2.82-.11-.27-.47-1.34.1-2.78 0 0 .88-.28 2.88 1.07a9.9 9.9 0 0 1 5.24 0c2-1.35 2.88-1.07 2.88-1.07.57 1.44.21 2.51.1 2.78.67.74 1.08 1.67 1.08 2.82 0 4.03-2.46 4.92-4.8 5.18.38.33.71.97.71 1.96v2.9c0 .28.19.61.72.5A10.5 10.5 0 0 0 12 1.5Z" />
    </svg>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
