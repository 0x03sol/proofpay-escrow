/** Monochrome mark aligned with giwa.io (black/white + verified green only for the seal). */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#111111" />
      <rect x="12.5" y="12.5" width="39" height="39" rx="9" fill="none" stroke="#ffffff" strokeWidth="2.5" />
      <rect x="19" y="19" width="26" height="26" rx="5" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity="0.35" />
      <path d="M24 32.5L29.5 38L41 26.5" stroke="#4ade80" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="brand">
      <Mark />
      <span>
        Proof<span style={{ color: 'var(--text)' }}>Pay</span>
      </span>
    </div>
  );
}
