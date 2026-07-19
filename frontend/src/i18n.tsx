import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'ko' | 'en';

type Dict = Record<string, { ko: string; en: string }>;

// All user-visible copy. Korean is the primary language.
export const STRINGS: Dict = {
  'nav.overview': { ko: '개요', en: 'Overview' },
  'nav.invoices': { ko: '인보이스', en: 'Invoices' },
  'nav.howItWorks': { ko: '작동 방식', en: 'How it works' },

  'wallet.connect': { ko: '지갑 연결', en: 'Connect wallet' },
  'wallet.connecting': { ko: '연결 중', en: 'Connecting' },
  'wallet.disconnect': { ko: '연결 해제', en: 'Disconnect' },
  'wallet.install': { ko: '지갑 설치', en: 'Install a wallet' },
  'wallet.switch': { ko: 'GIWA 세폴리아로 전환', en: 'Switch to GIWA Sepolia' },
  'wallet.wrongChain': { ko: '네트워크가 올바르지 않습니다. 지갑을 GIWA 세폴리아로 전환하세요.', en: 'Wrong network. Switch your wallet to GIWA Sepolia.' },
  'wallet.switchNow': { ko: '지금 전환', en: 'Switch now' },
  'wallet.upidReady': { ko: 'up.id 준비됨', en: 'up.id ready' },

  'badge.live': { ko: 'GIWA 세폴리아에서 운영 중', en: 'Live on GIWA Sepolia' },

  'hero.title.a': { ko: '결제 상대가', en: 'Escrow that knows' },
  'hero.title.acc': { ko: '누구인지', en: 'who' },
  'hero.title.b': { ko: '아는 에스크로', en: 'you are paying' },
  'hero.sub': {
    ko: 'ProofPay는 특정 인보이스에 대해 결제를 보관하고, 구매자가 승인할 때만 자금을 지급합니다. 돈이 움직이기 전에 수취인은 Dojang 인증 주소로 검증됩니다.',
    en: 'ProofPay holds a payment against a specific invoice and releases it only when the buyer approves. The recipient is checked against a live Dojang verified-address attestation before any money moves.',
  },
  'hero.openApp': { ko: '앱 열기', en: 'Open the app' },
  'hero.noncustodial': {
    ko: '비수탁형. 자금은 오직 지불인, 판매자, 또는 최대 0.5%로 상한이 정해진 수수료로만 전달됩니다.',
    en: 'Non-custodial. Funds only ever reach the payer, the merchant, or a fee capped at 0.5%.',
  },

  'how.title': { ko: '결제는 이렇게 진행됩니다', en: 'How a payment works' },
  'how.sub': { ko: '온체인 4단계. 계정도, 수탁도, 오프체인 정산도 없습니다.', en: 'Four on-chain steps. No account, no custody, no off-chain settlement.' },
  'how.1.t': { ko: '판매자 검증', en: 'Merchant is verified' },
  'how.1.b': { ko: 'Dojang 인증 주소를 보유한 수취인만 인보이스를 발행할 수 있습니다. 검증은 온체인에서 읽어옵니다.', en: 'A recipient with a live Dojang Verified Address attestation can issue invoices. Verification is read on-chain, not asserted by us.' },
  'how.2.t': { ko: '인보이스 생성', en: 'Invoice is created' },
  'how.2.b': { ko: '판매자가 금액, 자산, 환불 기간을 게시합니다. 온체인에는 문서 해시만 저장됩니다.', en: 'The merchant posts an amount, asset, and refund window. Only a document hash goes on-chain.' },
  'how.3.t': { ko: '구매자가 에스크로에 입금', en: 'Buyer funds escrow' },
  'how.3.b': { ko: '지불인이 에스크로 컨트랙트에 입금합니다. 판매자 검증은 생성 시점뿐 아니라 입금 시점에도 다시 확인됩니다.', en: 'The payer sends funds into the escrow contract. The merchant verification is re-checked at funding time.' },
  'how.4.t': { ko: '지급, 환불, 또는 분쟁', en: 'Release, refund, or dispute' },
  'how.4.b': { ko: '구매자가 인도 시 지급합니다. 아무 일도 없으면 타임아웃 환불로 자금이 돌아갑니다. 양측 모두 분쟁을 열 수 있습니다.', en: 'The buyer releases on delivery. If nothing happens, a timeout refund returns the funds. Either party can open a dispute.' },

  'guar.title': { ko: '컨트랙트가 보장하는 것', en: 'What the contract guarantees' },
  'guar.1.t': { ko: '소유자는 자금을 옮길 수 없습니다', en: 'The owner cannot move your funds' },
  'guar.1.b': { ko: '관리자 인출 경로가 없습니다. 에스크로 자금은 지불인, 판매자, 또는 상한 수수료 수취인에게만 갈 수 있습니다.', en: 'There is no admin withdrawal path. Escrowed funds can only go to the payer, merchant, or the capped fee recipient.' },
  'guar.2.t': { ko: '수수료는 코드로 상한이 정해집니다', en: 'Fee is capped in code' },
  'guar.2.b': { ko: '프로토콜 수수료는 0.5%로 고정되며 1%를 넘을 수 없습니다. 판매자 수령액에서 차감되고 환불에는 절대 더해지지 않습니다.', en: 'The protocol fee is fixed at 0.5% and can never exceed 1%. It is taken from the merchant proceeds, never added to a refund.' },
  'guar.3.t': { ko: '구매자는 방치되지 않습니다', en: 'Buyers are not stranded' },
  'guar.3.b': { ko: '인보이스에 환불 기간을 둘 수 있습니다. 기간이 지나면 누구나 지불인에게 환불을 실행할 수 있습니다.', en: 'Invoices can carry a refund window. Once it passes, anyone can trigger a refund back to the payer.' },
  'guar.4.t': { ko: '분쟁 권한은 제한적입니다', en: 'Disputes have bounded power' },
  'guar.4.b': { ko: '분쟁은 에스크로를 잠급니다. 중재자는 실제 지불인과 판매자 사이에서만 분할할 수 있고, 다른 곳으로 보낼 수 없습니다.', en: 'A dispute locks the escrow. The arbitrator can only split it between the real payer and merchant, never redirect it elsewhere.' },

  'contracts.title': { ko: '배포된 컨트랙트', en: 'Deployed contracts' },
  'contracts.sub': { ko: 'GIWA 세폴리아 익스플로러에서 직접 확인하세요.', en: 'Verify everything yourself on the GIWA Sepolia explorer.' },

  'footer.note': { ko: 'ProofPay는 GIWA 세폴리아 테스트넷에서 운영됩니다. 메인넷 자산을 보내지 마세요.', en: 'ProofPay runs on GIWA Sepolia testnet. Do not send mainnet assets.' },
  'footer.source': { ko: '소스', en: 'Source' },

  'app.title': { ko: '인보이스', en: 'Invoices' },
  'app.sub': { ko: 'GIWA 세폴리아의 ProofPay 컨트랙트에서 실시간으로 읽어옵니다.', en: 'Read live from the ProofPay contracts on GIWA Sepolia.' },
  'app.refresh': { ko: '새로고침', en: 'Refresh' },
  'app.loading': { ko: 'GIWA에서 인보이스를 읽는 중', en: 'Reading invoices from GIWA' },
  'app.empty.t': { ko: '아직 인보이스가 없습니다', en: 'No invoices yet' },
  'app.empty.b': { ko: '이것은 실제 온체인 상태이며 자리표시자가 아닙니다. 검증된 판매자가 오른쪽 패널에서 첫 인보이스를 생성할 수 있습니다.', en: 'This is the real on-chain state, not a placeholder. A verified merchant can create the first invoice from the panel on the right.' },

  'list.invoice': { ko: '인보이스', en: 'Invoice' },
  'list.merchant': { ko: '판매자', en: 'Merchant' },
  'list.amount': { ko: '금액', en: 'Amount' },

  'create.title': { ko: '인보이스 생성', en: 'Create an invoice' },
  'create.connect': { ko: '인보이스를 발행하려면 지갑을 연결하세요.', en: 'Connect a wallet to issue an invoice.' },
  'create.switch': { ko: '계속하려면 GIWA 세폴리아로 전환하세요.', en: 'Switch to GIWA Sepolia to continue.' },
  'create.gate': { ko: '이 지갑에는 유효한 Dojang 인증 주소가 없어 레지스트리가 인보이스를 거부합니다. GIWA 세폴리아에서는 업비트 코리아가 이 인증을 발급합니다.', en: 'This wallet has no live Dojang Verified Address attestation, so the registry will reject an invoice from it. On GIWA Sepolia these attestations are issued by Upbit Korea.' },
  'create.amount': { ko: '금액 (ETH)', en: 'Amount (ETH)' },
  'create.amount.hint': { ko: '지급, 환불, 또는 분쟁 해결 시까지 에스크로에 보관됩니다.', en: 'Held in escrow until you release, refund, or a dispute resolves.' },
  'create.ref': { ko: '인보이스 참조', en: 'Invoice reference' },
  'create.ref.hint': { ko: '온체인에 해시(keccak256)로 저장됩니다. 원문은 브라우저를 떠나지 않습니다.', en: 'Hashed on-chain (keccak256). The text itself never leaves your browser.' },
  'create.payer': { ko: '예상 지불인 (선택)', en: 'Expected payer (optional)' },
  'create.payer.hint': { ko: '비워두면 누구나 지불할 수 있습니다.', en: 'Leave blank to allow any payer.' },
  'create.window': { ko: '타임아웃 환불 기간 (시간)', en: 'Timeout refund window (hours)' },
  'create.window.hint': { ko: '지급 없이 이 시간이 지나면 누구나 지불인에게 환불할 수 있습니다. 0이면 비활성화됩니다.', en: 'After this passes with no release, anyone can refund the payer. 0 disables it.' },
  'create.requirePayer': { ko: '지불인도 Dojang 검증을 받도록 요구', en: 'Require the payer to also be Dojang verified' },
  'create.submit': { ko: '인보이스 생성', en: 'Create invoice' },
  'create.submitting': { ko: '제출 중', en: 'Submitting' },
  'create.err.amount': { ko: '유효한 ETH 금액을 입력하세요', en: 'Enter a valid ETH amount' },
  'create.err.positive': { ko: '금액은 0보다 커야 합니다', en: 'Amount must be greater than zero' },
  'create.err.payer': { ko: '예상 지불인 주소가 올바르지 않습니다', en: 'Expected payer is not a valid address' },

  'detail.loading': { ko: '인보이스를 불러오는 중', en: 'Loading invoice' },
  'detail.invoice': { ko: '인보이스', en: 'Invoice' },
  'detail.merchant': { ko: '판매자', en: 'Merchant' },
  'detail.payer': { ko: '지불인', en: 'Payer' },
  'detail.anyPayer': { ko: '모든 지불인', en: 'any payer' },
  'detail.receives': { ko: '판매자 수령액', en: 'Merchant receives' },
  'detail.fee': { ko: '프로토콜 수수료', en: 'Protocol fee' },
  'detail.created': { ko: '생성', en: 'Created' },
  'detail.timeoutAt': { ko: '타임아웃 환불 시점', en: 'Timeout refund at' },
  'detail.payerReq': { ko: '지불인 요건', en: 'Payer requirement' },
  'detail.payerReqVal': { ko: 'Dojang 검증 필요', en: 'must be Dojang verified' },
  'detail.docHash': { ko: '문서 해시', en: 'Document hash' },
  'detail.actions': { ko: '작업', en: 'Actions' },
  'detail.connectToAct': { ko: '이 인보이스에 대해 작업하려면 GIWA 세폴리아에 연결하세요.', en: 'Connect to GIWA Sepolia to act on this invoice.' },
  'detail.fund': { ko: '에스크로 입금', en: 'Fund escrow' },
  'detail.erc20note': { ko: 'ERC-20 입금은 토큰 승인 단계가 필요합니다. 이 데모는 네이티브 ETH 인보이스를 사용합니다.', en: 'ERC-20 funding needs a token approval step; this demo uses native ETH invoices.' },
  'detail.cancel': { ko: '인보이스 취소', en: 'Cancel invoice' },
  'detail.release': { ko: '판매자에게 지급', en: 'Release to merchant' },
  'detail.refund': { ko: '지불인에게 환불', en: 'Refund the payer' },
  'detail.timeout': { ko: '타임아웃 환불 실행', en: 'Trigger timeout refund' },
  'detail.dispute': { ko: '분쟁 열기', en: 'Open dispute' },
  'detail.locked': { ko: '에스크로가 잠겼고 중재를 기다리고 있습니다.', en: 'Escrow is locked and awaiting arbitration.' },
  'detail.settled': { ko: '이 인보이스는 정산되었습니다. 추가 작업이 없습니다.', en: 'This invoice is settled. No further actions.' },
  'detail.onlyParties': { ko: '입금 상태에서는 지불인 또는 판매자만 작업할 수 있습니다.', en: 'Only the payer or merchant can act while funded.' },
  'detail.back': { ko: '모든 인보이스', en: 'All invoices' },

  'tx.signing': { ko: '지갑에서 승인하세요', en: 'Confirm in your wallet' },
  'tx.mining': { ko: '온체인 확정을 기다리는 중', en: 'Waiting for on-chain confirmation' },
  'tx.success': { ko: 'GIWA에서 확정됨', en: 'Confirmed on GIWA' },
  'tx.error': { ko: '트랜잭션 실패', en: 'Transaction failed' },

  'status.verified': { ko: '검증됨', en: 'verified' },
  'status.unverified': { ko: '미검증', en: 'unverified' },
  'status.dojangVerified': { ko: 'Dojang 검증됨', en: 'Dojang verified' },

  'inv.None': { ko: '없음', en: 'None' },
  'inv.Open': { ko: '열림', en: 'Open' },
  'inv.Funded': { ko: '입금됨', en: 'Funded' },
  'inv.Released': { ko: '지급됨', en: 'Released' },
  'inv.Refunded': { ko: '환불됨', en: 'Refunded' },
  'inv.Disputed': { ko: '분쟁 중', en: 'Disputed' },
  'inv.Cancelled': { ko: '취소됨', en: 'Cancelled' },
  'inv.Resolved': { ko: '해결됨', en: 'Resolved' },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof STRINGS | string) => string;
}

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('proofpay.lang') as Lang) || 'ko');

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('proofpay.lang', lang);
  }, [lang]);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang: setLangState,
      t: (key) => {
        const entry = STRINGS[key as string];
        return entry ? entry[lang] : (key as string);
      },
    }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}
