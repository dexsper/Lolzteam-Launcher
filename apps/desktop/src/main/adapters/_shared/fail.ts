import type { LoginMethod, LoginResult } from '@adapter-contract';

// Shared `fail` factory for adapter login results. Returns `ok: false` with the
// given message; `method` defaults to 'native' because both Steam and Telegram
// adapters only support that method today.
export const failLogin = (message: string, method: LoginMethod = 'native'): LoginResult => ({
  ok: false,
  method,
  message,
});
