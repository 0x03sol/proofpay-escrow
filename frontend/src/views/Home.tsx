import { Mark } from '../components/Logo';
import { AddrLink, GithubIcon } from '../components/ui';
import { ADDRESSES, CHAIN_NAME, EXPLORER_URL, REPO_URL } from '../lib/config';
import { useI18n } from '../i18n';

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="panel panel-pad">
      <div className="mono" style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 14 }}>{n}</div>
      <h4 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h4>
      <p className="dim" style={{ fontSize: 15 }}>{body}</p>
    </div>
  );
}

export function Home({ go }: { go: (r: 'home' | 'app') => void }) {
  const { t } = useI18n();
  return (
    <main>
      {/* Hero */}
      <section className="shell" style={{ padding: 'clamp(56px, 10vw, 120px) 0 clamp(48px, 7vw, 90px)', textAlign: 'center' }}>
        <span className="badge verified" style={{ marginBottom: 26 }}>
          <span className="dot" /> {t('badge.live')}
        </span>
        <h1 style={{ fontSize: 'clamp(40px, 7vw, 82px)', maxWidth: 1000, margin: '0 auto' }}>
          {t('hero.title.a')} <span style={{ color: 'var(--verified)' }}>{t('hero.title.acc')}</span> {t('hero.title.b')}
        </h1>
        <p className="dim" style={{ fontSize: 'clamp(16px, 2vw, 20px)', maxWidth: 680, margin: '26px auto 0' }}>
          {t('hero.sub')}
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 36, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-accent" onClick={() => go('app')}>
            {t('hero.openApp')}
          </button>
          <a className="btn btn-ghost" href="#how">
            {t('nav.howItWorks')}
          </a>
        </div>
        <p className="faint" style={{ fontSize: 13, marginTop: 26, maxWidth: 560, marginInline: 'auto' }}>
          {t('hero.noncustodial')}
        </p>
      </section>

      {/* How it works */}
      <section id="how" className="shell" style={{ padding: 'clamp(48px, 7vw, 90px) 0' }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>{t('nav.howItWorks')}</p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', marginBottom: 8 }}>{t('how.title')}</h2>
        <p className="dim" style={{ marginBottom: 32, fontSize: 17 }}>{t('how.sub')}</p>
        <div className="cards">
          <Step n="01" title={t('how.1.t')} body={t('how.1.b')} />
          <Step n="02" title={t('how.2.t')} body={t('how.2.b')} />
          <Step n="03" title={t('how.3.t')} body={t('how.3.b')} />
          <Step n="04" title={t('how.4.t')} body={t('how.4.b')} />
        </div>
      </section>

      {/* Guarantees */}
      <section style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="shell" style={{ padding: 'clamp(48px, 7vw, 90px) 0' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', marginBottom: 32 }}>{t('guar.title')}</h2>
          <div className="cards">
            <Step n="" title={t('guar.1.t')} body={t('guar.1.b')} />
            <Step n="" title={t('guar.2.t')} body={t('guar.2.b')} />
            <Step n="" title={t('guar.3.t')} body={t('guar.3.b')} />
            <Step n="" title={t('guar.4.t')} body={t('guar.4.b')} />
          </div>
        </div>
      </section>

      {/* Contracts */}
      <section className="shell" style={{ padding: 'clamp(48px, 7vw, 90px) 0' }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', marginBottom: 8 }}>{t('contracts.title')}</h2>
        <p className="dim" style={{ marginBottom: 28, fontSize: 17 }}>{t('contracts.sub')}</p>
        <div className="panel">
          {(
            [
              ['ProofPayEscrow', ADDRESSES.proofPayEscrow],
              ['InvoiceRegistry', ADDRESSES.invoiceRegistry],
              ['DisputeModule', ADDRESSES.disputeModule],
              ['DojangVerifier (testnet demo)', ADDRESSES.dojangVerifier],
              ['DojangScroll (GIWA)', ADDRESSES.dojangScroll],
            ] as const
          ).map(([name, addr], i, arr) => (
            <div key={name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '17px 22px', gap: 16 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{name}</span>
                <AddrLink addr={addr} />
              </div>
              {i < arr.length - 1 && <hr className="divider" />}
            </div>
          ))}
        </div>
        <p className="faint" style={{ fontSize: 13, marginTop: 16 }}>
          {CHAIN_NAME} ·{' '}
          <a href={EXPLORER_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--text-dim)' }}>
            {EXPLORER_URL.replace('https://', '')}
          </a>
        </p>
      </section>

      <footer style={{ borderTop: '1px solid var(--line)' }}>
        <div className="shell" style={{ padding: '32px 0', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Mark size={20} />
          <span className="faint" style={{ fontSize: 13 }}>{t('footer.note')}</span>
          <div className="spacer" />
          <a className="ghlink" href={REPO_URL} target="_blank" rel="noreferrer">
            <GithubIcon size={16} />
            <span style={{ fontSize: 13 }}>{t('footer.source')}</span>
          </a>
        </div>
      </footer>
    </main>
  );
}
