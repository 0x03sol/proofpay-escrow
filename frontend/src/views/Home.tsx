import { Mark, Logo } from '../components/Logo';
import { AddrLink, GithubIcon } from '../components/ui';
import { ADDRESSES, CHAIN_NAME, EXPLORER_URL, FEE_BPS, REPO_URL } from '../lib/config';

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="panel panel-pad" style={{ display: 'flex', gap: 14 }}>
      <div
        className="mono"
        style={{
          color: 'var(--verified)',
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid var(--line)',
          borderRadius: 6,
          height: 26,
          minWidth: 26,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {n}
      </div>
      <div>
        <h4 style={{ fontSize: 15, marginBottom: 4 }}>{title}</h4>
        <p className="dim" style={{ fontSize: 14 }}>
          {body}
        </p>
      </div>
    </div>
  );
}

export function Home({ go }: { go: (r: 'home' | 'app') => void }) {
  return (
    <main>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="shell" style={{ padding: '72px 0 60px' }}>
          <span className="badge verified" style={{ marginBottom: 20 }}>
            <span className="dot" /> Live on {CHAIN_NAME}
          </span>
          <h1 style={{ fontSize: 'clamp(34px, 5vw, 60px)', lineHeight: 1.04, maxWidth: 940 }}>
            Escrow that knows <span style={{ color: 'var(--verified)' }}>who</span> you are paying.
          </h1>
          <p className="dim" style={{ fontSize: 19, maxWidth: 720, marginTop: 20 }}>
            ProofPay holds a payment against a specific invoice and releases it only when the buyer approves. The
            recipient is checked against a live Dojang verified-address attestation before any money moves.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
            <button className="btn btn-accent" onClick={() => go('app')}>
              Open the app
            </button>
            <a className="btn btn-ghost" href="#how">
              How it works
            </a>
          </div>
          <p className="faint mono" style={{ fontSize: 12, marginTop: 22 }}>
            Non-custodial. Funds only ever reach the payer, the merchant, or a fee capped at {FEE_BPS / 100}%.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="shell" style={{ padding: '56px 0' }}>
        <h2 style={{ fontSize: 26, marginBottom: 6 }}>How a payment works</h2>
        <p className="dim" style={{ marginBottom: 26 }}>
          Four on-chain steps. No account, no custody, no off-chain settlement.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          <Step n="1" title="Merchant is verified" body="A recipient with a live Dojang Verified Address attestation can issue invoices. Verification is read on-chain, not asserted by us." />
          <Step n="2" title="Invoice is created" body="The merchant posts an amount, asset, and refund window. Only a document hash goes on-chain; the invoice itself stays off it." />
          <Step n="3" title="Buyer funds escrow" body="The payer sends funds into the escrow contract. The merchant's verification is re-checked at funding time, not just at creation." />
          <Step n="4" title="Release, refund, or dispute" body="The buyer releases on delivery. If nothing happens, a timeout refund returns the funds. Either party can open a dispute." />
        </div>
      </section>

      {/* Guarantees */}
      <section style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--bg-raise)' }}>
        <div className="shell" style={{ padding: '56px 0' }}>
          <h2 style={{ fontSize: 26, marginBottom: 26 }}>What the contract guarantees</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div className="panel panel-pad">
              <h4 style={{ fontSize: 15, marginBottom: 6 }}>The owner cannot move your funds</h4>
              <p className="dim" style={{ fontSize: 14 }}>
                There is no admin withdrawal path. Escrowed funds can only go to the invoice payer, its merchant, or the
                capped fee recipient.
              </p>
            </div>
            <div className="panel panel-pad">
              <h4 style={{ fontSize: 15, marginBottom: 6 }}>Fee is capped in code</h4>
              <p className="dim" style={{ fontSize: 14 }}>
                The protocol fee is fixed at {FEE_BPS / 100}% and can never exceed 1%. It is taken from the merchant's
                proceeds, never added to a refund.
              </p>
            </div>
            <div className="panel panel-pad">
              <h4 style={{ fontSize: 15, marginBottom: 6 }}>Buyers are not stranded</h4>
              <p className="dim" style={{ fontSize: 14 }}>
                Invoices can carry a refund window. Once it passes, anyone can trigger a refund back to the payer.
              </p>
            </div>
            <div className="panel panel-pad">
              <h4 style={{ fontSize: 15, marginBottom: 6 }}>Disputes have bounded power</h4>
              <p className="dim" style={{ fontSize: 14 }}>
                A dispute locks the escrow. The arbitrator can only split it between the real payer and merchant, never
                redirect it elsewhere.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contracts */}
      <section className="shell" style={{ padding: '56px 0' }}>
        <h2 style={{ fontSize: 26, marginBottom: 6 }}>Deployed contracts</h2>
        <p className="dim" style={{ marginBottom: 22 }}>
          Verify everything yourself on the {CHAIN_NAME} explorer.
        </p>
        <div className="panel">
          {(
            [
              ['ProofPayEscrow', ADDRESSES.proofPayEscrow],
              ['InvoiceRegistry', ADDRESSES.invoiceRegistry],
              ['DisputeModule', ADDRESSES.disputeModule],
              ['DojangVerifier', ADDRESSES.dojangVerifier],
              ['DojangScroll (GIWA)', ADDRESSES.dojangScroll],
            ] as const
          ).map(([name, addr], i, arr) => (
            <div key={name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
                <AddrLink addr={addr} />
              </div>
              {i < arr.length - 1 && <hr className="divider" />}
            </div>
          ))}
        </div>
        <p className="faint" style={{ fontSize: 13, marginTop: 14 }}>
          Explorer: <a href={EXPLORER_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--text-dim)' }}>{EXPLORER_URL.replace('https://', '')}</a>
        </p>
      </section>

      <footer style={{ borderTop: '1px solid var(--line)' }}>
        <div className="shell" style={{ padding: '28px 0', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Mark size={20} />
          <span className="faint" style={{ fontSize: 13 }}>
            ProofPay runs on GIWA Sepolia testnet. Do not send mainnet assets.
          </span>
          <div className="spacer" />
          <a className="ghlink" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source on GitHub">
            <GithubIcon size={16} />
            <span style={{ fontSize: 13 }}>Source</span>
          </a>
        </div>
      </footer>
    </main>
  );
}

export { Logo };
