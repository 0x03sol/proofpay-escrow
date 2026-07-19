export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#0E1413" />
      <rect x="12.5" y="12.5" width="39" height="39" rx="9" fill="none" stroke="#38E8A0" strokeWidth="2.5" />
      <rect x="19" y="19" width="26" height="26" rx="5" fill="none" stroke="#38E8A0" strokeWidth="1.2" opacity="0.45" />
      <path d="M24 32.5L29.5 38L41 26.5" stroke="#38E8A0" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="brand">
      <Mark />
      <span>
        Proof<span style={{ color: 'var(--verified)' }}>Pay</span>
      </span>
    </div>
  );
}
