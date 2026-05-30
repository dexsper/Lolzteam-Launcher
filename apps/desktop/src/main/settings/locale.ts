import { app } from 'electron';
import type { Locale, LocalePreference } from '@shared-types';

export const resolveSystemLocale = (): Locale =>
  app.getLocale().toLowerCase().startsWith('ru') ? 'ru' : 'en';

export const resolveEffectiveLocale = (pref: LocalePreference): Locale =>
  pref === 'system' ? resolveSystemLocale() : pref;
