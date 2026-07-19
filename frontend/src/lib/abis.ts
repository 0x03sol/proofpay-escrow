export const registryAbi = [
  { type: 'function', name: 'invoiceCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'requireVerifiedMerchant', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'statusOf', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'uint8' }] },
  {
    type: 'function',
    name: 'getInvoice',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'merchant', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'payer', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'fundBy', type: 'uint64' },
          { name: 'refundAfter', type: 'uint64' },
          { name: 'requireVerifiedPayer', type: 'bool' },
          { name: 'status', type: 'uint8' },
          { name: 'documentHash', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'createInvoice',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'payer', type: 'address' },
      { name: 'fundBy', type: 'uint64' },
      { name: 'refundAfter', type: 'uint64' },
      { name: 'requireVerifiedPayer', type: 'bool' },
      { name: 'documentHash', type: 'bytes32' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  { type: 'function', name: 'cancelInvoice', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }], outputs: [] },
] as const;

export const escrowAbi = [
  {
    type: 'function',
    name: 'getEscrow',
    stateMutability: 'view',
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    outputs: [
      { name: 'payer', type: 'address' },
      { name: 'fundedAt', type: 'uint64' },
      { name: 'disputed', type: 'bool' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  { type: 'function', name: 'feeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'fund', stateMutability: 'payable', inputs: [{ name: 'invoiceId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'release', stateMutability: 'nonpayable', inputs: [{ name: 'invoiceId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'refundByMerchant', stateMutability: 'nonpayable', inputs: [{ name: 'invoiceId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'refundExpired', stateMutability: 'nonpayable', inputs: [{ name: 'invoiceId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'openDispute', stateMutability: 'nonpayable', inputs: [{ name: 'invoiceId', type: 'uint256' }], outputs: [] },
] as const;

export const verifierAbi = [
  { type: 'function', name: 'isVerified', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const;

export const INVOICE_STATUS = ['None', 'Open', 'Funded', 'Released', 'Refunded', 'Disputed', 'Cancelled', 'Resolved'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export interface InvoiceView {
  merchant: `0x${string}`;
  token: `0x${string}`;
  payer: `0x${string}`;
  amount: bigint;
  createdAt: bigint;
  fundBy: bigint;
  refundAfter: bigint;
  requireVerifiedPayer: boolean;
  status: number;
  documentHash: `0x${string}`;
}
