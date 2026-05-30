import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AuthSession } from '@shared-types';
import logoUrl from '~/assets/logolzt.svg';
import s from './TopBar.module.scss';

interface TopBarProps {
  session: AuthSession | null;
}

const formatBalance = (balance: number | null, currency: string | null, locale: string) => {
  if (balance === null) return null;
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
  const formatted = new Intl.NumberFormat(intlLocale, {
    maximumFractionDigits: 2,
  }).format(balance);
  return `${formatted} ${currency ?? ''}`.trim();
};

export const TopBar = ({ session }: TopBarProps) => {
  const { t, i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const balance = session
    ? formatBalance(session.balance, session.currency, i18n.language)
    : null;

  return (
    <header className={s.topbar}>
      <img className={s.brandLogo} src={logoUrl} aria-hidden alt="Lolzteam" />
      {session && (
        <div className={s.profile} ref={profileRef}>
          <button
            type="button"
            className={s.profileTrigger}
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {session.avatarUrl ? (
              <img className={s.avatar} src={session.avatarUrl} alt="" />
            ) : (
              <div className={s.avatarFallback}>
                <User size={16} />
              </div>
            )}
            <div className={s.profileText}>
              {session.usernameHtml ? (
                <span
                  className={s.username}
                  dangerouslySetInnerHTML={{ __html: session.usernameHtml }}
                />
              ) : (
                <span className={s.username}>{session.username}</span>
              )}
              {balance && <span className={s.balance}>{balance}</span>}
            </div>
            <ChevronDown
              size={16}
              className={`${s.chevron} ${menuOpen ? s.chevronOpen : ''}`}
            />
          </button>

          {menuOpen && (
            <div className={s.menu} role="menu">
              <button
                type="button"
                className={s.menuItem}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  window.launcher.auth.logout();
                }}
              >
                <LogOut size={16} />
                <span>{t('topbar.logout')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
