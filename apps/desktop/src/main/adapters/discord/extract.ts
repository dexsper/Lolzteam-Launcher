import type { AccountDetails } from '@shared-types';

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

export const extractDiscordToken = (details: AccountDetails): string | null => {
  const direct = asString(details.loginRaw);
  if (direct) return direct;

  const secrets = (details.secrets ?? {}) as Record<string, unknown>;
  const ld = secrets.loginData;
  if (ld && typeof ld === 'object') {
    const fromLoginData = asString((ld as { login?: unknown }).login);
    if (fromLoginData) return fromLoginData;
  }
  return asString(secrets.account_login);
};
