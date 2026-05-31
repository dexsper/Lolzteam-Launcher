import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LauncherSettings, LocalePreference } from '@shared-types';
import { Modal } from '~/widgets/Modal/Modal';
import s from './SettingsView.module.scss';

const LOCALE_OPTIONS: readonly LocalePreference[] = ['system', 'ru', 'en'] as const;

export const SettingsView = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [picking, setPicking] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [exportingLog, setExportingLog] = useState(false);
  const [logExported, setLogExported] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

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

  const pickTelegramExe = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const path = await window.launcher.settings.pickFile({
        title: t('settings.telegram.pickDialogTitle'),
        filters: [{ name: 'Telegram', extensions: ['exe'] }],
      });
      if (path) {
        const next = await window.launcher.settings.set({ telegramExePath: path });
        setSettings(next.settings);
      }
    } finally {
      setPicking(false);
    }
  };

  const clearTelegramExe = async () => {
    const next = await window.launcher.settings.set({ telegramExePath: null });
    setSettings(next.settings);
  };

  const setLocale = async (locale: LocalePreference) => {
    const next = await window.launcher.settings.set({ locale });
    setSettings(next.settings);
    setLangOpen(false);
  };

  const toggleSteamInvisible = async () => {
    const next = await window.launcher.settings.set({
      steamInvisible: !(settings?.steamInvisible ?? false),
    });
    setSettings(next.settings);
  };

  const clearCache = async () => {
    if (clearingCache) return;
    setClearingCache(true);
    setCacheCleared(false);
    try {
      await window.launcher.accounts.clearCache();
      // Drop the cached list so the next visit to "My accounts" refetches fresh.
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      setCacheCleared(true);
    } finally {
      setClearingCache(false);
    }
  };

  const exportLog = async () => {
    if (exportingLog) return;
    setExportingLog(true);
    setLogExported(false);
    try {
      const result = await window.launcher.app.exportLog();
      if (result.ok) setLogExported(true);
    } finally {
      setExportingLog(false);
    }
  };

  const tgPath = settings?.telegramExePath ?? null;
  const currentLocale: LocalePreference = settings?.locale ?? 'system';
  const steamInvisible = settings?.steamInvisible ?? false;

  const cacheDescription = clearingCache
    ? t('settings.cache.clearing')
    : cacheCleared
      ? t('settings.cache.cleared')
      : t('settings.cache.menuHint');

  const logsDescription = exportingLog
    ? t('settings.logs.exporting')
    : logExported
      ? t('settings.logs.exported')
      : t('settings.logs.menuHint');

  return (
    <>
      <div className={s.settingsContainer}>
        <div className={s.settingsBlock}>
          <div className={s.settingsItem}>
            <span className={s.prefix}>Telegram</span>
            <div
              className={s.settingsMenu}
              role="button"
              tabIndex={0}
              onClick={pickTelegramExe}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void pickTelegramExe();
                }
              }}
            >
              <div className={s.text}>
                <span className={s.title}>{t('settings.telegram.sessionFolder')}</span>
                <div className={s.descriptionBlock}>
                  <span className={s.description}>
                    {tgPath ?? t('settings.telegram.placeholderNoFile')}
                  </span>
                  {tgPath && (
                    <span
                      className={s.greenText}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        void clearTelegramExe();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          void clearTelegramExe();
                        }
                      }}
                    >
                      {t('settings.telegram.clear')}
                    </span>
                  )}
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M1.9974 4.16783C1.9974 3.79417 2.40191 3.33333 2.95785 3.33333H5.33073C5.73748 3.33333 6.16935 3.48564 6.42771 3.73436C6.43317 3.73966 6.43877 3.74486 6.44446 3.74997L7.46144 4.66373C7.5838 4.77369 7.74251 4.83449 7.907 4.83449H11.7036C12.1528 4.83449 12.6027 5.14209 12.6724 5.5784C12.7305 5.94196 13.0724 6.1896 13.4359 6.13151C13.7995 6.07342 14.0471 5.73156 13.989 5.368C13.7876 4.10732 12.6104 3.50116 11.7036 3.50116H8.16251L7.34344 2.76523C6.78873 2.23674 6.00508 2 5.33073 2H2.95785C1.75108 2 0.664062 2.97506 0.664062 4.16783V12C0.664062 12.0286 0.665858 12.0567 0.669347 12.0844C0.594049 13.0485 1.35757 14 2.4 14H11.5958C12.7362 14 13.777 13.2931 14.2114 12.2367L15.2134 9.73289L15.2145 9.73004C15.6487 8.63022 14.8118 7.33333 13.5948 7.33333H4.39908C3.689 7.33333 3.07906 7.6048 2.58244 8.01996C2.3466 8.20182 2.15198 8.4204 1.9974 8.67V4.16783ZM3.4298 9.04947C3.73051 8.7956 4.04909 8.66667 4.39908 8.66667H13.5948C13.7042 8.66667 13.8267 8.72742 13.915 8.85964C14.0038 8.99262 14.0155 9.13511 13.9746 9.23951L13.9743 9.2404L12.9771 11.7323C12.7446 12.2947 12.1868 12.6667 11.5958 12.6667H2.4C2.2906 12.6667 2.16812 12.6059 2.07984 12.4737C1.99108 12.3408 1.97938 12.1983 2.02015 12.094L3.01896 9.59787L3.02009 9.59502C3.11251 9.36093 3.24167 9.19356 3.40307 9.07089C3.41216 9.064 3.42107 9.05684 3.4298 9.04947Z" fill="currentColor"/>
              </svg>
            </div>
          </div>
          <div className={s.settingsItem}>
            <span className={s.prefix}>Steam</span>
            <div className={s.settingsMenu}>
              <div className={s.text}>
                <span className={s.title}>{t('settings.steam.invisibleLabel')}</span>
                <div className={s.descriptionBlock}>
                  <span className={s.description}>{t('settings.steam.invisibleHint')}</span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={steamInvisible}
                className={s.toggleRow}
                onClick={toggleSteamInvisible}
              >
                <span className={`${s.switch} ${steamInvisible ? s.switchOn : ''}`}>
                  <span className={s.switchKnob} />
                </span>
              </button>
            </div>
          </div>
          <div className={s.settingsItem}>
            <span className={s.prefix}>{t('settings.app.title')}</span>
            <div
              className={s.settingsMenu}
              role="button"
              tabIndex={0}
              onClick={() => setLangOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setLangOpen(true);
                }
              }}
            >
              <div className={s.text}>
                <span className={s.title}>{t('settings.language.menuLabel')}</span>
                <div className={s.descriptionBlock}>
                  <span className={s.description}>
                    {t(`settings.language.${currentLocale}`)}
                  </span>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M2 12H22M2 12C2 17.5228 6.47715 22 12 22M2 12C2 6.47715 6.47715 2 12 2M22 12C22 17.5228 17.5228 22 12 22M22 12C22 6.47715 17.5228 2 12 2M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22M12 2C9.49872 4.73835 8.07725 8.29203 8 12C8.07725 15.708 9.49872 19.2616 12 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div
              className={s.settingsMenu}
              role="button"
              tabIndex={0}
              aria-disabled={clearingCache}
              onClick={clearCache}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void clearCache();
                }
              }}
            >
              <div className={s.text}>
                <span className={s.title}>{t('settings.cache.menuLabel')}</span>
                <div className={s.descriptionBlock}>
                  <span className={cacheCleared && !clearingCache ? s.greenText : s.description}>
                    {cacheDescription}
                  </span>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 3H15M3 6H21M19 6L18.2987 16.5193C18.1935 18.0975 18.1409 18.8867 17.8 19.485C17.4999 20.0118 17.0472 20.4353 16.5017 20.6997C15.882 21 15.0911 21 13.5093 21H10.4907C8.90891 21 8.11803 21 7.49834 20.6997C6.95276 20.4353 6.50009 20.0118 6.19998 19.485C5.85911 18.8867 5.8065 18.0975 5.70129 16.5193L5 6M10 10.5V15.5M14 10.5V15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div
              className={s.settingsMenu}
              role="button"
              tabIndex={0}
              aria-disabled={exportingLog}
              onClick={exportLog}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void exportLog();
                }
              }}
            >
              <div className={s.text}>
                <span className={s.title}>{t('settings.logs.menuLabel')}</span>
                <div className={s.descriptionBlock}>
                  <span className={logExported && !exportingLog ? s.greenText : s.description}>
                    {logsDescription}
                  </span>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M13 3C13 2.44772 12.5523 2 12 2C11.4477 2 11 2.44772 11 3V12.5858L7.70711 9.29289C7.31658 8.90237 6.68342 8.90237 6.29289 9.29289C5.90237 9.68342 5.90237 10.3166 6.29289 10.7071L11.2929 15.7071C11.6834 16.0976 12.3166 16.0976 12.7071 15.7071L17.7071 10.7071C18.0976 10.3166 18.0976 9.68342 17.7071 9.29289C17.3166 8.90237 16.6834 8.90237 16.2929 9.29289L13 12.5858V3Z" fill="currentColor"/>
                <path d="M3 14C3.55229 14 4 14.4477 4 15V16.2C4 17.0566 4.00078 17.6389 4.03755 18.089C4.07337 18.5274 4.1383 18.7516 4.21799 18.908C4.40973 19.2843 4.7157 19.5903 5.09202 19.782C5.24842 19.8617 5.47262 19.9266 5.91104 19.9624C6.36113 19.9992 6.94342 20 7.8 20H16.2C17.0566 20 17.6389 19.9992 18.089 19.9624C18.5274 19.9266 18.7516 19.8617 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C19.8617 18.7516 19.9266 18.5274 19.9624 18.089C19.9992 17.6389 20 17.0566 20 16.2V15C20 14.4477 20.4477 14 21 14C21.5523 14 22 14.4477 22 15V16.2413C22 17.0463 22 17.7106 21.9558 18.2518C21.9099 18.8139 21.8113 19.3306 21.564 19.816C21.1805 20.5686 20.5686 21.1805 19.816 21.564C19.3306 21.8113 18.8139 21.9099 18.2518 21.9558C17.7106 22 17.0463 22 16.2413 22H7.7587C6.95373 22 6.28937 22 5.74818 21.9558C5.18608 21.9099 4.66937 21.8113 4.18404 21.564C3.43139 21.1805 2.81947 20.5686 2.43598 19.816C2.18868 19.3306 2.09012 18.8139 2.04419 18.2518C1.99998 17.7106 1.99999 17.0463 2 16.2413V15C2 14.4477 2.44772 14 3 14Z" fill="currentColor"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {langOpen && (
        <Modal title={t('settings.language.modalTitle')} closable onClose={() => setLangOpen(false)}>
          <div className={s.langList} role="radiogroup" aria-label={t('settings.language.modalTitle')}>
            {LOCALE_OPTIONS.map((opt) => {
              const active = currentLocale === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`${s.langOption} ${active ? s.langOptionActive : ''}`}
                  onClick={() => setLocale(opt)}
                >
                  <span>{t(`settings.language.${opt}`)}</span>
                  {active && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
};
