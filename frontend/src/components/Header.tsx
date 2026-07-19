import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { Spinner, VerifiedBadge, GithubIcon } from './ui';
import type { WalletState } from '../hooks/useWallet';
import { shortAddr } from '../lib/format';
import { isVerified } from '../lib/data';
import { REPO_URL } from '../lib/config';
import { useI18n } from '../i18n';

type Route = 'home' | 'app';

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="langtoggle" role="group" aria-label="Language">
      <button className={lang === 'ko' ? 'on' : ''} onClick={() => setLang('ko')}>
        KO
      </button>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
        EN
      </button>
    </div>
  );
}

export function Header({ route, go, wallet }: { route: Route; go: (r: Route) => void; wallet: WalletState }) {
  const { t } = useI18n();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let live = true;
    if (wallet.account && !wallet.wrongChain) {
      void isVerified(wallet.account).then((v) => live && setVerified(v)).catch(() => setVerified(false));
    } else {
      setVerified(false);
    }
    return () => {
      live = false;
    };
  }, [wallet.account, wallet.wrongChain]);

  return (
    <header className="hdr">
      <div className="shell hdr-in">
        <a onClick={() => go('home')} style={{ cursor: 'pointer' }}>
          <Logo />
        </a>
        <nav className="nav">
          <a className={route === 'home' ? 'active' : ''} onClick={() => go('home')}>
            {t('nav.overview')}
          </a>
          <a className={route === 'app' ? 'active' : ''} onClick={() => go('app')}>
            {t('nav.invoices')}
          </a>
        </nav>
        <div className="spacer" />

        <LangToggle />

        <a className="ghlink" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub">
          <GithubIcon />
        </a>

        {wallet.account && !wallet.wrongChain && verified && <VerifiedBadge verified label={t('wallet.upidReady')} />}

        {!wallet.hasWallet ? (
          <a className="btn btn-sm" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
            {t('wallet.install')}
          </a>
        ) : !wallet.account ? (
          <button className="btn btn-accent btn-sm" onClick={() => void wallet.connect()} disabled={wallet.isConnecting}>
            {wallet.isConnecting ? <Spinner /> : null}
            {wallet.isConnecting ? t('wallet.connecting') : t('wallet.connect')}
          </button>
        ) : wallet.wrongChain ? (
          <button className="btn btn-accent btn-sm" onClick={() => void wallet.switchChain()}>
            {t('wallet.switch')}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge neutral" title={wallet.account}>
              <span className="dot" style={{ background: 'var(--verified)' }} />
              {shortAddr(wallet.account)}
            </span>
            <button className="btn btn-sm btn-ghost" onClick={wallet.disconnect}>
              {t('wallet.disconnect')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
