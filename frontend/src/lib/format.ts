import { formatEther } from 'viem';

export const ZERO = '0x0000000000000000000000000000000000000000';

export function shortAddr(a?: string): string {
  if (!a) return '';
  return `${a.slice(0, 6)}\u2026${a.slice(-4)}`;
}

export function fmtEth(wei: bigint): string {
  const s = formatEther(wei);
  // trim trailing zeros but keep it readable
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

export function isNative(token: string): boolean {
  return token.toLowerCase() === ZERO;
}

export function tokenLabel(token: string): string {
  return isNative(token) ? 'ETH' : shortAddr(token);
}

export function fmtDate(unix: bigint | number): string {
  const n = Number(unix);
  if (!n) return 'n/a';
  return new Date(n * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function statusTone(status: number): 'verified' | 'pending' | 'dispute' | 'neutral' {
  switch (status) {
    case 2:
      return 'pending'; // Funded
    case 3:
    case 7:
      return 'verified'; // Released / Resolved
    case 5:
      return 'dispute'; // Disputed
    default:
      return 'neutral';
  }
}
