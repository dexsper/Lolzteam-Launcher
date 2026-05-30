import { useEffect } from 'react';
import { i18n } from './index';

export const useLocaleSync = (): void => {
  useEffect(() => {
    const off = window.launcher.settings.onChanged((next) => {
      if (i18n.language !== next.effectiveLocale) {
        void i18n.changeLanguage(next.effectiveLocale);
      }
    });
    return off;
  }, []);
};
