import { useState } from 'react';
import { ExternalLink, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import s from './LoginScreen.module.scss';

export const LoginScreen = () => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'inapp' | 'browser' | null>(null);

  const handleInApp = async () => {
    setBusy('inapp');
    try {
      await window.launcher.auth.openInApp();
    } finally {
      setBusy(null);
    }
  };

  const handleBrowser = async () => {
    setBusy('browser');
    try {
      await window.launcher.auth.openBrowser();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.brand}>
          <span className={s.brandDot} aria-hidden />
          <h1>Lolzteam Launcher</h1>
        </div>
        <p className={s.lede}>{t('login.lede')}</p>

        <div className={s.actions}>
          <button
            type="button"
            className={s.primary}
            onClick={handleInApp}
            disabled={busy !== null}
          >
            <LogIn size={18} />
            <span>{busy === 'inapp' ? t('login.busyInApp') : t('login.openInApp')}</span>
          </button>

          <button
            type="button"
            className={s.secondary}
            onClick={handleBrowser}
            disabled={busy !== null}
          >
            <ExternalLink size={16} />
            <span>
              {busy === 'browser' ? t('login.busyBrowser') : t('login.openBrowser')}
            </span>
          </button>
        </div>

        <p className={s.hint}>{t('login.hint')}</p>
      </div>
    </div>
  );
};
