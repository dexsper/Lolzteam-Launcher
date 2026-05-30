import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Database,
  EyeOff,
  FolderOpen,
  Languages,
  Loader2,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LauncherSettings, LocalePreference } from '@shared-types';
import s from './SettingsView.module.scss';

const LOCALE_OPTIONS: readonly LocalePreference[] = ['system', 'ru', 'en'] as const;

export const SettingsView = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [picking, setPicking] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

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
  };

  const toggleSteamInvisible = async () => {
    const next = await window.launcher.settings.set({
      steamInvisible: !(settings?.steamInvisible ?? false),
    });
    setSettings(next.settings);
  };

  const clearCache = async () => {
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

  const tgPath = settings?.telegramExePath ?? null;
  const currentLocale: LocalePreference = settings?.locale ?? 'system';
  const steamInvisible = settings?.steamInvisible ?? false;

  return (
    <div className={s.view}>
      <header className={s.header}>
        <h2 className={s.heading}>{t('settings.heading')}</h2>
        <p className={s.sub}>{t('settings.subheading')}</p>
      </header>

      <section className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardIcon}>
            <Send size={18} />
          </span>
          <div className={s.cardHeadText}>
            <h3 className={s.cardTitle}>{t('settings.telegram.title')}</h3>
            <p className={s.cardDesc}>{t('settings.telegram.description')}</p>
          </div>
        </div>

        <div className={s.field}>
          <span className={s.fieldLabel}>{t('settings.telegram.fieldLabel')}</span>
          <div className={s.pathRow}>
            <input
              type="text"
              className={s.pathInput}
              readOnly
              value={tgPath ?? ''}
              placeholder={t('settings.telegram.placeholderNoFile')}
            />
            <button
              type="button"
              className={s.pickBtn}
              onClick={pickTelegramExe}
              disabled={picking}
            >
              {picking ? (
                <Loader2 size={16} className={s.spin} />
              ) : (
                <FolderOpen size={16} />
              )}
              <span>{t('settings.telegram.pickButton')}</span>
            </button>
          </div>

          <div className={s.statusRow}>
            {tgPath ? (
              <span className={s.statusOk}>
                <CheckCircle2 size={14} />
                {t('settings.telegram.statusOk')}
              </span>
            ) : (
              <span className={s.statusMuted}>
                <XCircle size={14} />
                {t('settings.telegram.statusMissing')}
              </span>
            )}
            {tgPath && (
              <button type="button" className={s.clearBtn} onClick={clearTelegramExe}>
                {t('settings.telegram.clear')}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardIcon}>
            <Languages size={18} />
          </span>
          <div className={s.cardHeadText}>
            <h3 className={s.cardTitle}>{t('settings.language.title')}</h3>
            <p className={s.cardDesc}>{t('settings.language.description')}</p>
          </div>
        </div>

        <div className={s.segmented} role="radiogroup" aria-label={t('settings.language.title')}>
          {LOCALE_OPTIONS.map((opt) => {
            const active = currentLocale === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={active}
                className={`${s.segmentBtn} ${active ? s.segmentBtnActive : ''}`}
                onClick={() => setLocale(opt)}
              >
                {t(`settings.language.${opt}`)}
              </button>
            );
          })}
        </div>
      </section>

      <section className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardIcon}>
            <EyeOff size={18} />
          </span>
          <div className={s.cardHeadText}>
            <h3 className={s.cardTitle}>{t('settings.steam.title')}</h3>
            <p className={s.cardDesc}>{t('settings.steam.description')}</p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={steamInvisible}
          className={s.toggleRow}
          onClick={toggleSteamInvisible}
        >
          <span className={s.toggleText}>
            <span className={s.toggleLabel}>{t('settings.steam.invisibleLabel')}</span>
            <span className={s.toggleHint}>{t('settings.steam.invisibleHint')}</span>
          </span>
          <span className={`${s.switch} ${steamInvisible ? s.switchOn : ''}`}>
            <span className={s.switchKnob} />
          </span>
        </button>
      </section>

      <section className={s.card}>
        <div className={s.cardHead}>
          <span className={s.cardIcon}>
            <Database size={18} />
          </span>
          <div className={s.cardHeadText}>
            <h3 className={s.cardTitle}>{t('settings.cache.title')}</h3>
            <p className={s.cardDesc}>{t('settings.cache.description')}</p>
          </div>
        </div>

        <div className={s.statusRow}>
          <button
            type="button"
            className={s.dangerBtn}
            onClick={clearCache}
            disabled={clearingCache}
          >
            {clearingCache ? (
              <Loader2 size={16} className={s.spin} />
            ) : (
              <Trash2 size={16} />
            )}
            <span>
              {clearingCache
                ? t('settings.cache.clearing')
                : t('settings.cache.clearButton')}
            </span>
          </button>
          {cacheCleared && !clearingCache && (
            <span className={s.statusOk}>
              <CheckCircle2 size={14} />
              {t('settings.cache.cleared')}
            </span>
          )}
        </div>
      </section>
    </div>
  );
};
