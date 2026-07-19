import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Home } from './views/Home';
import { AppView } from './views/AppView';
import { useWallet } from './hooks/useWallet';
import { useI18n } from './i18n';

type Route = 'home' | 'app';

function routeFromHash(): Route {
  return window.location.hash.replace('#/', '') === 'app' ? 'app' : 'home';
}

export default function App() {
  const wallet = useWallet();
  const { t } = useI18n();
  const [route, setRoute] = useState<Route>(routeFromHash());

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (r: Route) => {
    window.location.hash = r === 'app' ? '#/app' : '#/';
    setRoute(r);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <Header route={route} go={go} wallet={wallet} />
      {wallet.wrongChain && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--pending) 12%, var(--bg))',
            borderBottom: '1px solid color-mix(in srgb, var(--pending) 40%, var(--line))',
            color: 'var(--pending)',
            fontSize: 13,
            textAlign: 'center',
            padding: '9px 12px',
          }}
        >
          {t('wallet.wrongChain')}{' '}
          <button
            className="mono"
            onClick={() => void wallet.switchChain()}
            style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {t('wallet.switchNow')}
          </button>
        </div>
      )}
      {route === 'app' ? <AppView wallet={wallet} /> : <Home go={go} />}
    </>
  );
}
