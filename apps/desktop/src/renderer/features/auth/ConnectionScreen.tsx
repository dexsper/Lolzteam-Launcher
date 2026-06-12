import type { AuthStatus } from '@shared-types';
import { CloudOff, Globe, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import backgroundUrl from '~/assets/background.svg';
import { AppProxyModal } from './AppProxyModal';
import s from './ConnectionScreen.module.scss';

interface ConnectionScreenProps {
  onRetry: () => Promise<AuthStatus | undefined>;
}

export const ConnectionScreen = ({ onRetry }: ConnectionScreenProps) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [proxyOpen, setProxyOpen] = useState(false);
  const busyRef = useRef(false);
  const pendingRef = useRef(false);

  const retry = async () => {
    if (busyRef.current) {
      pendingRef.current = true;
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      do {
        pendingRef.current = false;
        await onRetry();
      } while (pendingRef.current);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className={s.container}>
      <div
        className={s.background}
        aria-hidden="true"
        style={{ '--login-bg': `url(${backgroundUrl})` } as React.CSSProperties}
      />
      <div className={s.block}>
        <div className={s.iconRing}>
          <CloudOff size={28} />
        </div>
        <div className={s.text}>
          <span className={s.title}>{t('connection.title')}</span>
          <span className={s.description}>{t('connection.subtitle')}</span>
        </div>

        <div className={s.actions}>
          <button type="button" className={s.button} onClick={() => void retry()} disabled={busy}>
            <RefreshCw size={16} className={busy ? s.spin : ''} />
            <span>{busy ? t('connection.retrying') : t('connection.retry')}</span>
          </button>
          <button
            type="button"
            className={s.proxyButton}
            onClick={() => setProxyOpen(true)}
            disabled={busy}
            aria-label={t('connection.proxy')}
            title={t('connection.proxy')}
          >
            <Globe size={18} />
          </button>
        </div>
      </div>

      {proxyOpen && (
        <AppProxyModal onClose={() => setProxyOpen(false)} onChanged={() => void retry()} />
      )}
    </div>
  );
};
