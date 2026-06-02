export const formatAgo = (epochMs: number, locale: string): string => {
  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' });
  const diffSec = Math.round((epochMs - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
};
