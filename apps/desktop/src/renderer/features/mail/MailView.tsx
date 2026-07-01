import type { MailLetter } from '@shared-types';
import DOMPurify from 'dompurify';
import { AtSign, ChevronDown, Inbox, Loader2, Search, X } from 'lucide-react';
import { type MouseEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMailTarget } from '~/stores/mailTarget';
import { useSettings } from '~/stores/settings';
import s from './MailView.module.scss';

const LIMIT = 50;
const HISTORY_MAX = 8;

const openExternal = (url: string) => {
  if (/^https?:\/\//i.test(url)) void window.launcher.app.openExternal(url);
};

const onBodyClick = (e: MouseEvent<HTMLElement>) => {
  const anchor = (e.target as HTMLElement).closest('a');
  if (anchor?.href) {
    e.preventDefault();
    openExternal(anchor.href);
  }
};

const formatDate = (sec: number | null, locale: string): string | null => {
  if (sec === null) return null;
  const d = new Date(sec * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

const htmlToText = (html: string): string =>
  new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';

const previewOf = (letter: MailLetter): string => {
  const raw = letter.textPlain ?? (letter.textHtml ? htmlToText(letter.textHtml) : '');
  return raw.replace(/\s+/g, ' ').trim().slice(0, 160);
};

const emailOf = (entry: string): string => entry.split(':')[0] ?? entry;

const URL_RE = /(https?:\/\/[^\s]+)/g;
const TRAILING = /[.,;:!?)\]}'"]+$/;
const isUrl = (str: string) => /^https?:\/\//i.test(str);

const PlainBody = ({ text }: { text: string }) => (
  <pre className={s.bodyText}>
    {text.split(URL_RE).map((part, i) => {
      if (!isUrl(part)) return part;
      const trail = part.match(TRAILING)?.[0] ?? '';
      const url = trail ? part.slice(0, -trail.length) : part;
      return (
        <span key={i}>
          <a
            className={s.link}
            href={url}
            onClick={(e) => {
              e.preventDefault();
              openExternal(url);
            }}
          >
            {url}
          </a>
          {trail}
        </span>
      );
    })}
  </pre>
);

const LetterBody = ({ letter }: { letter: MailLetter }) => {
  if (letter.textPlain) return <PlainBody text={letter.textPlain} />;
  if (letter.textHtml) {
    return (
      <div
        className={s.bodyHtml}
        onClick={onBodyClick}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: third-party email HTML, sanitized to inert markup
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(letter.textHtml, {
            FORBID_TAGS: ['style', 'script', 'iframe', 'link', 'form', 'input'],
            FORBID_ATTR: ['style', 'onerror', 'onload'],
          }),
        }}
      />
    );
  }
  return null;
};

export const MailView = () => {
  const { t, i18n } = useTranslation();
  const history = useSettings((st) => st.settings?.mailHistory ?? []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letters, setLetters] = useState<MailLetter[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const pushHistory = async (entry: string) => {
    const cur = useSettings.getState().settings?.mailHistory ?? [];
    const next = [entry, ...cur.filter((e) => e !== entry)].slice(0, HISTORY_MAX);
    await window.launcher.settings.set({ mailHistory: next });
  };

  const removeHistory = async (entry: string) => {
    const cur = useSettings.getState().settings?.mailHistory ?? [];
    await window.launcher.settings.set({ mailHistory: cur.filter((e) => e !== entry) });
  };

  const run = async (value: string) => {
    const v = value.trim();
    if (!v.includes(':')) {
      setError(t('mail.invalidInput'));
      return;
    }
    if (loading) return;
    setLoading(true);
    setError(null);
    setOpenId(null);
    try {
      const res = await window.launcher.mail.getLetters({ emailPassword: v, limit: LIMIT });
      if (res.ok) {
        setLetters(res.letters);
        void pushHistory(v);
        if (res.letters.length === 0) setError(t('mail.empty'));
      } else {
        setLetters(null);
        setError(t(`mail.error.${res.message}`, { defaultValue: res.message }));
      }
    } finally {
      setLoading(false);
    }
  };

  const useEntry = (entry: string) => {
    setInput(entry);
    void run(entry);
  };

  useEffect(() => {
    const pending = useMailTarget.getState().pending;
    if (pending) {
      useMailTarget.getState().setPending(null);
      setInput(pending);
      void run(pending);
    }
  }, []);

  return (
    <div className={s.container}>
      <div className={s.block}>
        <div className={s.section}>
          <span className={s.prefix}>{t('mail.title')}</span>
          <div className={s.sectionBody}>
            <span className={s.hint}>{t('mail.subtitle')}</span>
            <div className={s.formRow}>
              <input
                className={s.input}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError(null);
                }}
                placeholder={t('mail.placeholder')}
                spellCheck={false}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void run(input);
                  }
                }}
              />
              <button
                type="button"
                className={s.fetchBtn}
                onClick={() => void run(input)}
                disabled={loading || input.trim() === ''}
              >
                {loading ? <Loader2 size={16} className={s.spin} /> : <Search size={16} />}
                <span>{loading ? t('mail.loading') : t('mail.fetch')}</span>
              </button>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className={s.section}>
            <span className={s.prefix}>{t('mail.history')}</span>
            <ul className={s.rows}>
              {history.map((entry) => (
                <li key={entry} className={s.row}>
                  <button type="button" className={s.rowMain} onClick={() => useEntry(entry)}>
                    <AtSign size={16} className={s.rowIcon} />
                    <span className={s.rowLabel}>{emailOf(entry)}</span>
                  </button>
                  <button
                    type="button"
                    className={s.rowRemove}
                    onClick={() => void removeHistory(entry)}
                    aria-label={t('mail.removeFromHistory')}
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className={s.error}>{error}</p>}

        {loading && (
          <div className={s.state}>
            <Loader2 size={26} className={s.spin} />
            <span>{t('mail.loadingHint')}</span>
          </div>
        )}

        {!loading && letters && letters.length > 0 && (
          <div className={s.section}>
            <span className={s.prefix}>{t('mail.lettersTitle', { count: letters.length })}</span>
            <ul className={s.letterList}>
              {letters.map((letter) => {
                const open = openId === letter.id;
                const date = formatDate(letter.date, i18n.language);
                const preview = previewOf(letter);
                return (
                  <li key={letter.id} className={`${s.letter} ${open ? s.letterOpen : ''}`}>
                    <button
                      type="button"
                      className={s.letterHead}
                      onClick={() => setOpenId(open ? null : letter.id)}
                    >
                      <div className={s.letterMeta}>
                        <span className={s.letterFrom}>
                          {letter.from ?? t('mail.unknownSender')}
                        </span>
                        <span className={s.letterPreview}>{preview || t('mail.noPreview')}</span>
                      </div>
                      {date && <span className={s.letterDate}>{date}</span>}
                      <ChevronDown
                        size={16}
                        className={`${s.letterChevron} ${open ? s.letterChevronOpen : ''}`}
                      />
                    </button>
                    {open && (
                      <div className={s.letterBody}>
                        <LetterBody letter={letter} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!loading && !error && letters === null && (
          <div className={s.state}>
            <Inbox size={26} className={s.stateIcon} />
            <span>{t('mail.idle')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
