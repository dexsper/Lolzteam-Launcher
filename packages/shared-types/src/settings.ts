export type LocalePreference = 'system' | 'ru' | 'en';
export type Locale = 'ru' | 'en';

export interface LauncherSettings {
  telegramExePath: string | null;
  locale: LocalePreference;
  /** Sign into Steam with an invisible online status. */
  steamInvisible: boolean;
}

export const DEFAULT_SETTINGS: LauncherSettings = {
  telegramExePath: null,
  locale: 'system',
  steamInvisible: false,
};

export interface SettingsResponse {
  settings: LauncherSettings;
  effectiveLocale: Locale;
}

export interface PickFileOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  defaultPath?: string;
}
