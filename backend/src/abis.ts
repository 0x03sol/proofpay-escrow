// Minimal ABIs for the deployed ProofPay contracts: the events the indexer consumes
// and the view functions the API reads live. Kept hand-written and in sync with src/.

export const invoiceRegistryAbi = [
  {
    type: 'event',
    name: 'InvoiceCreated',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'documentHash', type: 'bytes32', indexed: false },
    ],
  },
  { type: 'event', name: 'InvoiceCancelled', inputs: [{ name: 'id', type: 'uint256', indexed: true }] },
  {
    type: 'event',
    name: 'InvoiceStatusChanged',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'status', type: 'uint8', indexed: false },
    ],
  },
  { type: 'function', name: 'statusOf', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'invoiceCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
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
] as const;

export const proofPayEscrowAbi = [
  {
    type: 'event',
    name: 'PaymentReceived',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EscrowReleased',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'amountToMerchant', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RefundExecuted',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'reason', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeOpened',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'opener', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'DisputeResolved',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'payerAmount', type: 'uint256', indexed: false },
      { name: 'merchantAmount', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
    ],
  },
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
] as const;

export const disputeModuleAbi = [
  {
    type: 'event',
    name: 'DisputeRegistered',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'opener', type: 'address', indexed: true },
      { name: 'payer', type: 'address', indexed: false },
      { name: 'merchant', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EvidenceSubmitted',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'party', type: 'address', indexed: true },
      { name: 'evidenceHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeResolved',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'payerBps', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const dojangVerifierAbi = [
  { type: 'function', name: 'isVerified', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const;

/// Human-readable invoice status names indexed by the on-chain enum value.
export const INVOICE_STATUS = [
  'None',
  'Open',
  'Funded',
  'Released',
  'Refunded',
  'Disputed',
  'Cancelled',
  'Resolved',
] as const;

export const REFUND_REASON = ['Merchant', 'Timeout'] as const;
