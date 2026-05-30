import { spawn } from 'node:child_process';
import { rename, rm } from 'node:fs/promises';
import type {
  AdapterContext,
  LoginMethod,
  LoginResult,
  ProbeResult,
  ServiceAdapter,
} from '@adapter-contract';
import type { AccountDetails } from '@shared-types';
import type { StringSessionData } from '@mtcute/node/utils.js';
import { failLogin as fail } from '../_shared/fail';
import { extractTelegramCreds, type TelegramAuthKey, type TelegramCreds } from './extract';
import { killTelegramProcesses, waitForTelegramExit } from './process';
import { ensurePortableMarker, fileExists, getTdataDir } from './paths';
import { acquireTelegramSession, buildOfflineSession } from './session';
import { mergeSessions, readExistingSessions, toSessionData, writeTdata } from './tdata';

type SessionSource = StringSessionData | string;

interface AcquireOutcome {
  session: SessionSource;
  /** "offline" = built from authKey, no network; "online" = phone+code login. */
  via: 'offline' | 'online';
}

const tryOfflineSession = (
  authKey: TelegramAuthKey,
  ctx: AdapterContext,
): AcquireOutcome | { error: string } => {
  try {
    const session = buildOfflineSession({
      authKeyHex: authKey.authKeyHex,
      dcId: authKey.dcId,
    });
    ctx.log.info(`[telegram] offline session built (dc=${authKey.dcId})`);
    return { session, via: 'offline' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.log.warn(`[telegram] offline session build failed: ${msg}`);
    return { error: msg };
  }
};

const acquireOnlineSession = async (
  creds: TelegramCreds,
  account: AccountDetails,
  ctx: AdapterContext,
): Promise<AcquireOutcome | { error: string }> => {
  if (!creds.phone) {
    return { error: 'Нет телефона для phone+code входа' };
  }
  if (!ctx.fetchTelegramCode) {
    return { error: 'fetchTelegramCode не проброшен в адаптер' };
  }

  ctx.onProgress?.({ step: 'sending-tg-code' });
  ctx.log.info(`[telegram] online login for ${creds.phone}`);

  try {
    const { sessionString } = await acquireTelegramSession({
      phone: creds.phone,
      password: creds.password,
      apiId: creds.apiId,
      apiHash: creds.apiHash,
      abortSignal: ctx.abortSignal,
      onCodeNeeded: async () => {
        ctx.onProgress?.({ step: 'awaiting-tg-code' });
        ctx.onProgress?.({ step: 'fetching-tg-code' });
        ctx.log.info('[telegram] fetching login code from market');
        const code = await ctx.fetchTelegramCode!(account.itemId);
        if (!code) throw new Error('Не удалось получить код с маркета');
        ctx.onProgress?.({ step: 'verifying-tg-code' });
        return code;
      },
    });
    return { session: sessionString, via: 'online' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/PASSWORD_HASH_INVALID/i.test(msg)) {
      return { error: 'Аккаунт защищён 2FA, но пароль неверный или отсутствует' };
    }
    if (/PHONE_CODE_INVALID|PHONE_CODE_EXPIRED/i.test(msg)) {
      return { error: 'Код подтверждения неверный или просрочен' };
    }
    return { error: `Не удалось войти в Telegram: ${msg}` };
  }
};

export const telegramAdapter: ServiceAdapter = {
  id: 'telegram',
  displayName: 'Telegram',
  platforms: ['win32'] as const,
  methods: ['native'] as const,

  async probe(method: LoginMethod, ctx: AdapterContext): Promise<ProbeResult> {
    if (method !== 'native') {
      return { available: false, reason: 'Только native-вход поддерживается' };
    }
    if (process.platform !== 'win32') {
      return { available: false, reason: 'Telegram-адаптер работает только на Windows' };
    }
    const exe = ctx.settings?.telegramExePath;
    if (!exe) {
      return { available: false, reason: 'Укажите путь к Telegram.exe в Настройках' };
    }
    if (!(await fileExists(exe))) {
      return { available: false, reason: 'Telegram.exe не найден по указанному пути' };
    }
    return { available: true };
  },

  async login(
    method: LoginMethod,
    account: AccountDetails,
    ctx: AdapterContext,
  ): Promise<LoginResult> {
    if (method !== 'native') return fail('Только native-вход поддерживается', method);
    if (process.platform !== 'win32') return fail('Telegram-адаптер работает только на Windows');
    if (ctx.abortSignal.aborted) return fail('Вход отменён');

    const exe = ctx.settings?.telegramExePath;
    if (!exe || !(await fileExists(exe))) {
      return fail('Укажите путь к Telegram.exe в Настройках');
    }

    const creds = extractTelegramCreds(account);
    if (!creds) return fail('У этого аккаунта нет данных Telegram в lzt.market');

    // Primary path: phone + SMS-code via mtcute. Reliable: TDesktop reads the
    // resulting tdata without complaints. The offline auth_key path
    // (`tryOfflineSession`) stays in the code as a fallback for когда мы
    // разберёмся с настоящим форматом `loginData.raw`, но сейчас выключен
    // как primary — TDesktop не принимает собранную из него tdata.
    let outcome: AcquireOutcome | { error: string };
    outcome = await acquireOnlineSession(creds, account, ctx);
    if ('error' in outcome && creds.authKey) {
      ctx.log.warn(
        `[telegram] online login failed (${outcome.error}); trying offline auth_key as last resort`,
      );
      ctx.onProgress?.({ step: 'building-tdata' });
      const offlineAttempt = tryOfflineSession(creds.authKey, ctx);
      if (!('error' in offlineAttempt)) outcome = offlineAttempt;
    }

    if ('error' in outcome) return fail(outcome.error);

    ctx.onProgress?.({ step: 'killing-telegram' });
    ctx.log.info('[telegram] killing Telegram processes');
    await killTelegramProcesses();
    await waitForTelegramExit(5000);

    if (ctx.abortSignal.aborted) return fail('Вход отменён');

    ctx.onProgress?.({ step: 'writing-tdata' });
    let tdataDir: string;
    try {
      tdataDir = await getTdataDir(exe);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(`Папка с Telegram.exe недоступна на запись: ${msg}`);
    }
    // Preserve previously added accounts: read what's already in tdata, drop any
    // stale entry for this same user, prepend the new session (it becomes active)
    // and cap the total. Falls back to a single-account write if the existing
    // tdata can't be read (passcode/corruption/version), matching old behaviour.
    const incoming = toSessionData(outcome.session);
    const existing = await readExistingSessions(tdataDir, ctx.log);
    const merged = mergeSessions(incoming, existing);
    ctx.log.info(
      `[telegram] writing tdata to ${tdataDir}: ${merged.length} account(s) (via ${outcome.via})`,
    );
    // Write into a staging dir first, then swap it into place. This way a failed
    // write never destroys the existing tdata — we only rm the live folder once
    // the new one is fully written.
    const stagingDir = `${tdataDir}.new`;
    try {
      await rm(stagingDir, { recursive: true, force: true });
      await writeTdata(merged, stagingDir);
      await rm(tdataDir, { recursive: true, force: true });
      await rename(stagingDir, tdataDir);
    } catch (err) {
      await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
      const msg = err instanceof Error ? err.message : String(err);
      return fail(`Не удалось записать сессию tdata: ${msg}`);
    }

    // Without `tportable.tdat` next to the exe, Telegram Desktop reads
    // %APPDATA%\Telegram Desktop instead of our tdata and shows the phone-entry
    // screen — making the offline write look like it silently failed.
    try {
      await ensurePortableMarker(exe);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(`Не удалось создать маркер portable-режима: ${msg}`);
    }

    if (ctx.abortSignal.aborted) return fail('Вход отменён');

    ctx.onProgress?.({ step: 'launching-telegram' });
    ctx.log.info('[telegram] launching portable Telegram');
    const child = spawn(exe, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();

    const who = creds.phone || `аккаунт #${account.itemId}`;
    return {
      ok: true,
      method,
      launchedPid: child.pid,
      message: `Telegram запущен под ${who}`,
    };
  },
};
