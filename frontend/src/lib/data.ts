import { publicClient } from './clients';
import { ADDRESSES } from './config';
import { registryAbi, escrowAbi, verifierAbi, type InvoiceView } from './abis';
import { isNative, ZERO } from './format';

export interface InvoiceRecord extends InvoiceView {
  id: number;
}

export interface EscrowState {
  payer: `0x${string}`;
  fundedAt: bigint;
  disputed: boolean;
  amount: bigint;
}

export interface InvoiceDetail {
  invoice: InvoiceRecord;
  escrow: EscrowState | null;
  merchantVerified: boolean;
  payerVerified: boolean | null;
}

export async function isVerified(account: string): Promise<boolean> {
  return publicClient.readContract({
    address: ADDRESSES.dojangVerifier,
    abi: verifierAbi,
    functionName: 'isVerified',
    args: [account as `0x${string}`],
  });
}

export async function fetchInvoiceCount(): Promise<number> {
  const c = await publicClient.readContract({
    address: ADDRESSES.invoiceRegistry,
    abi: registryAbi,
    functionName: 'invoiceCount',
  });
  return Number(c);
}

export async function fetchInvoices(): Promise<InvoiceRecord[]> {
  const count = await fetchInvoiceCount();
  if (count === 0) return [];
  const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));
  const results = await publicClient.multicall({
    contracts: ids.map((id) => ({
      address: ADDRESSES.invoiceRegistry,
      abi: registryAbi,
      functionName: 'getInvoice' as const,
      args: [id] as const,
    })),
    allowFailure: true,
  });
  const out: InvoiceRecord[] = [];
  results.forEach((r, i) => {
    if (r.status === 'success' && r.result) {
      out.push({ id: Number(ids[i]), ...(r.result as InvoiceView) });
    }
  });
  return out.reverse(); // newest first
}

export async function fetchInvoiceDetail(id: number): Promise<InvoiceDetail> {
  const invoice = (await publicClient.readContract({
    address: ADDRESSES.invoiceRegistry,
    abi: registryAbi,
    functionName: 'getInvoice',
    args: [BigInt(id)],
  })) as InvoiceView;

  const [escrowRaw, merchantVerified] = await Promise.all([
    publicClient
      .readContract({ address: ADDRESSES.proofPayEscrow, abi: escrowAbi, functionName: 'getEscrow', args: [BigInt(id)] })
      .catch(() => null),
    isVerified(invoice.merchant),
  ]);

  // getEscrow returns a zero struct when unfunded — treat amount==0 as "no escrow".
  let escrow: EscrowState | null = null;
  if (escrowRaw) {
    const [payer, fundedAt, disputed, amount] = escrowRaw as [`0x${string}`, bigint, boolean, bigint];
    if (amount > 0n) {
      escrow = { payer, fundedAt, disputed, amount };
    }
  }

  let payerVerified: boolean | null = null;
  if (invoice.payer && invoice.payer !== ZERO) payerVerified = await isVerified(invoice.payer);

  return { invoice: { id, ...invoice }, escrow, merchantVerified, payerVerified };
}

export function feeFor(amount: bigint, feeBps: number): { merchant: bigint; fee: bigint } {
  const fee = (amount * BigInt(feeBps)) / 10000n;
  return { merchant: amount - fee, fee };
}

export const nativeToken = ZERO;
export const isEth = isNative;
