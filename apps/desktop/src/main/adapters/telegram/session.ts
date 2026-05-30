import { MemoryStorage, TelegramClient } from '@mtcute/node';
import type { StringSessionData } from '@mtcute/node/utils.js';
import { DC_MAPPING_PROD } from '@mtcute/convert';

// Fallback Telegram Desktop credentials, used only when the account doesn't
// carry its own api_id/api_hash. Logging in under the same app the account was
// registered with keeps the written tdata consistent and avoids security flags.
const FALLBACK_API_ID = 2040;
const FALLBACK_API_HASH = 'b18441a1ff607e10a989891a5462e627';

export interface AcquireParams {
  phone: string;
  password: string | null;
  apiId: number | null;
  apiHash: string | null;
  onCodeNeeded: () => Promise<string>;
  abortSignal: AbortSignal;
}

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) throw new Error('hex string has odd length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`invalid hex at offset ${i * 2}`);
    out[i] = byte;
  }
  return out;
};

// Build a StringSessionData object straight from a market-supplied auth_key.
// No network: convertToTdata accepts StringSessionData directly, so we never
// even have to call writeStringSession().
export const buildOfflineSession = (params: {
  authKeyHex: string;
  dcId: number;
}): StringSessionData => {
  const dcs = DC_MAPPING_PROD[params.dcId];
  if (!dcs) throw new Error(`Неизвестный DC id: ${params.dcId}`);
  const authKey = hexToBytes(params.authKeyHex);
  if (authKey.length !== 256) {
    throw new Error(`auth_key должен быть 256 байт, получено ${authKey.length}`);
  }
  // version: 3 matches writeStringSession's current output (validated against
  // string-session.ts in @mtcute/core 0.29.7). Other values throw at write time.
  return {
    version: 3,
    primaryDcs: dcs,
    authKey,
  };
};

// mtcute's TelegramClient.start() does not accept an AbortSignal. We race the
// login against a rejection-on-abort promise; if the user cancels mid-flight
// we still tear down the client in `finally`, so no socket is leaked.
const racePromiseWithAbort = async <T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> => {
  if (signal.aborted) throw new Error('Вход отменён');
  let onAbort: (() => void) | null = null;
  const abortPromise = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error('Вход отменён'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
};

export const acquireTelegramSession = async (
  params: AcquireParams,
): Promise<{ sessionString: string }> => {
  const tg = new TelegramClient({
    apiId: params.apiId ?? FALLBACK_API_ID,
    apiHash: params.apiHash ?? FALLBACK_API_HASH,
    storage: new MemoryStorage(),
    initConnectionOptions: {
      deviceModel: 'Desktop',
      systemVersion: 'Windows',
      appVersion: '5.7.0',
    },
  });

  try {
    await racePromiseWithAbort(
      tg.start({
        phone: async () => params.phone,
        code: params.onCodeNeeded,
        password: async () => params.password ?? '',
      }),
      params.abortSignal,
    );
    const sessionString = await tg.exportSession();
    return { sessionString };
  } finally {
    await tg.destroy();
  }
};
