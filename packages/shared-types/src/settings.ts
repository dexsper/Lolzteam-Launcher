import type { ServiceId } from './service-id';

export type LocalePreference = 'ru' | 'en';
export type Locale = 'ru' | 'en';

// Steam is proxy-capable only for the "open in browser" login; the native
// desktop-client login connects directly and ignores any selected proxy.
export const PROXY_CAPABLE_SERVICES: ServiceId[] = [
  'steam',
  'telegram',
  'tiktok',
  'instagram',
  'discord',
];

export interface ProxyTestResult {
  ok: boolean;
  ms?: number;
  ip?: string;
  message?: string;
  checkedAt: number;
}

export interface ProxyEntry {
  id: string;
  label?: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  test?: ProxyTestResult;
}

export interface LauncherSettings {
  telegramExePath: string | null;
  telegramMaxAccounts: number;
  locale: LocalePreference;
  /** Sign into Steam with an invisible online status. */
  steamInvisible: boolean;
  proxyEnabled: boolean;
  proxies: ProxyEntry[];
  proxyServices: ServiceId[];
  appProxyId: string | null;
  inventoryHideInvalid: boolean;
  inventorySortKey: InventorySortKey;
  inventorySortDir: InventorySortDir;
  mailHistory: string[];
}

export type InventorySortKey = 'purchased' | 'price' | 'warranty';
export type InventorySortDir = 'asc' | 'desc';

export const DEFAULT_SETTINGS: LauncherSettings = {
  telegramExePath: null,
  telegramMaxAccounts: 3,
  locale: 'ru',
  steamInvisible: false,
  proxyEnabled: false,
  proxies: [],
  proxyServices: [...PROXY_CAPABLE_SERVICES],
  appProxyId: null,
  inventoryHideInvalid: false,
  inventorySortKey: 'purchased',
  inventorySortDir: 'desc',
  mailHistory: [],
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
