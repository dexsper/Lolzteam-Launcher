import { app, BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log/main';
import type {
  AdapterContext,
  AdapterLogger,
  LoginMethod,
  LoginProgressEvent,
} from '@adapter-contract';
import { IPC_CHANNELS } from '@shared-ipc';
import { getAdapter } from '../adapters';
import {
  fetchEmailCode,
  fetchSteamMafile,
  fetchTelegramLoginCode,
  getAccountDetails,
} from '../services/market';
import { getSettings } from '../settings/settings-store';

const adapterLogger: AdapterLogger = {
  debug: (m, meta) => log.debug(m, meta),
  info: (m, meta) => log.info(m, meta),
  warn: (m, meta) => log.warn(m, meta),
  error: (m, meta) => log.error(m, meta),
};

const broadcast = (itemId: number, event: LoginProgressEvent): void => {
  const payload = { ...event, itemId };
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC_CHANNELS.ACCOUNT_LOGIN_PROGRESS, payload);
  }
};

const buildCtx = async (
  itemId: number,
  abortSignal: AbortSignal,
): Promise<AdapterContext> => ({
  log: adapterLogger,
  paths: {
    userData: app.getPath('userData'),
    logs: app.getPath('logs'),
    temp: app.getPath('temp'),
  },
  abortSignal,
  onProgress: (event) => broadcast(itemId, event),
  fetchEmailCode: (id) => fetchEmailCode(id, abortSignal),
  fetchTelegramCode: (id) => fetchTelegramLoginCode(id, abortSignal),
  fetchSteamMafile: (id) => fetchSteamMafile(id),
  settings: await getSettings(),
});

export const registerLoginIpc = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.ACCOUNT_LOGIN,
    async (_e, payload: { itemId: number; method: LoginMethod }) => {
      const { itemId, method } = payload;
      const ctl = new AbortController();
      broadcast(itemId, { step: 'fetching-credentials' });

      const details = await getAccountDetails(itemId);
      if (!details) return { ok: false, message: 'Не удалось получить данные аккаунта' };

      const adapter = getAdapter(details.category);
      if (!adapter) {
        return {
          ok: false,
          message: `Сервис "${details.categoryTitle}" пока не поддерживается`,
        };
      }

      try {
        const ctx = await buildCtx(itemId, ctl.signal);
        const result = await adapter.login(method, details, ctx);
        if (result.ok) broadcast(itemId, { step: 'done' });
        return { ok: result.ok, message: result.message };
      } catch (err) {
        log.error('[login] adapter threw', err);
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Неизвестная ошибка',
        };
      }
    },
  );
};
