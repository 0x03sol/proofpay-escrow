import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { Spinner, VerifiedBadge, GithubIcon } from './ui';
import type { WalletState } from '../hooks/useWallet';
import { shortAddr } from '../lib/format';
import { isVerified } from '../lib/data';
import { CHAIN_NAME, REPO_URL } from '../lib/config';

type Route = 'home' | 'app';

export function Header({ route, go, wallet }: { route: Route; go: (r: Route) => void; wallet: WalletState }) {
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
            Overview
          </a>
          <a className={route === 'app' ? 'active' : ''} onClick={() => go('app')}>
            Invoices
          </a>
        </nav>
        <div className="spacer" />

        <a
          className="ghlink"
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="ProofPay source on GitHub"
          title="View source on GitHub"
        >
          <GithubIcon />
        </a>

        {wallet.account && !wallet.wrongChain && verified && <VerifiedBadge verified label="up.id ready" />}

        {!wallet.hasWallet ? (
          <a className="btn btn-sm" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
            Install a wallet
          </a>
        ) : !wallet.account ? (
          <button className="btn btn-accent" onClick={() => void wallet.connect()} disabled={wallet.isConnecting}>
            {wallet.isConnecting ? <Spinner /> : null}
            {wallet.isConnecting ? 'Connecting' : 'Connect wallet'}
          </button>
        ) : wallet.wrongChain ? (
          <button className="btn btn-accent" onClick={() => void wallet.switchChain()}>
            Switch to {CHAIN_NAME}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge neutral" title={wallet.account}>
              <span className="dot" style={{ background: 'var(--verified)' }} />
              {shortAddr(wallet.account)}
            </span>
            <button className="btn btn-sm btn-ghost" onClick={wallet.disconnect}>
              Disconnect
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
