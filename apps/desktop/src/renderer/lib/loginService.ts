import type { AccountSummary } from '@shared-types';
import type { LoginMethod, LoginService } from '~/stores/loginSession';

const LOGIN_SERVICE_BY_CATEGORY: Partial<
  Record<NonNullable<AccountSummary['category']>, LoginService>
> = {
  steam: 'steam',
  telegram: 'telegram',
  tiktok: 'browser',
  instagram: 'browser',
  discord: 'discord',
  llm: 'llm',
};

export const toLoginService = (category: AccountSummary['category']): LoginService | null =>
  category ? (LOGIN_SERVICE_BY_CATEGORY[category] ?? null) : null;

export const loginMethodFor = (service: LoginService): 'native' | 'web' =>
  service === 'browser' || service === 'discord' || service === 'llm' ? 'web' : 'native';

const LOGIN_METHODS_BY_SERVICE: Partial<Record<LoginService, LoginMethod[]>> = {
  steam: ['native', 'web'],
};

export const loginMethodsFor = (service: LoginService): LoginMethod[] =>
  LOGIN_METHODS_BY_SERVICE[service] ?? [loginMethodFor(service)];

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

export const formatWarranty = (warrantyEndsAt: number | null, t: TFunc): string | null => {
  if (!warrantyEndsAt) return null;
  const ms = warrantyEndsAt * 1000 - Date.now();
  if (ms <= 0) return null;
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return t('inventory.card.warrantyDays', { count: days });
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return t('inventory.card.warrantyHours', { count: hours });
};
