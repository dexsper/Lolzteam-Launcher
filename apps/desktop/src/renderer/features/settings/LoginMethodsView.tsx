import type { LauncherSettings, ServiceId } from '@shared-types';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loginMethodsFor } from '~/lib/loginService';
import type { LoginMethod, LoginService } from '~/stores/loginSession';
import s from './LoginMethodsView.module.scss';

interface LoginMethodsViewProps {
  onBack: () => void;
}

const MULTI_METHOD: { id: ServiceId; service: LoginService; labelKey: string; hintKey: string }[] =
  [
    {
      id: 'steam',
      service: 'steam',
      labelKey: 'settings.loginMethods.steamLabel',
      hintKey: 'settings.loginMethods.steamHint',
    },
  ];

export const LoginMethodsView = ({ onBack }: LoginMethodsViewProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<LauncherSettings | null>(null);

  useEffect(() => {
    let alive = true;
    window.launcher.settings.get().then((next) => {
      if (alive) setSettings(next.settings);
    });
    const off = window.launcher.settings.onChanged((next) => setSettings(next.settings));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const prefs = settings?.preferredLoginMethod ?? {};

  const setMethod = async (id: ServiceId, value: 'ask' | LoginMethod) => {
    const nextPref: Partial<Record<ServiceId, LoginMethod>> = {};
    for (const [k, v] of Object.entries(prefs)) {
      if (k !== id && v) nextPref[k as ServiceId] = v;
    }
    if (value !== 'ask') nextPref[id] = value;
    const next = await window.launcher.settings.set({ preferredLoginMethod: nextPref });
    setSettings(next.settings);
  };

  return (
    <div className={s.container}>
      <div className={s.block}>
        <header className={s.header}>
          <button
            type="button"
            className={s.back}
            onClick={onBack}
            aria-label={t('settings.loginMethods.back')}
          >
            <ArrowLeft size={18} />
          </button>
          <span className={s.headerTitle}>{t('settings.loginMethods.menuLabel')}</span>
        </header>

        {MULTI_METHOD.map(({ id, service, labelKey, hintKey }) => {
          const options: ('ask' | LoginMethod)[] = ['ask', ...loginMethodsFor(service)];
          const current = prefs[id] ?? 'ask';
          return (
            <div key={id} className={s.row}>
              <div className={s.text}>
                <span className={s.title}>{t(labelKey)}</span>
                <span className={s.description}>{t(hintKey)}</span>
              </div>
              <div className={s.segmented}>
                {options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`${s.segmentBtn} ${current === opt ? s.segmentBtnActive : ''}`}
                    onClick={() => void setMethod(id, opt)}
                  >
                    {t(`settings.loginMethods.${opt}`)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
