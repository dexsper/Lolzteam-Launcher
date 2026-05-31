import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '@shared-ipc';

const ALLOWED_URL_PREFIXES = ['https://', 'http://'];

const logsDir = () => app.getPath('logs');
const logFile = () => join(logsDir(), 'main.log');

export const registerAppIpc = () => {
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => app.getVersion());

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_EXTERNAL, async (_e, payload: { url: string }) => {
    const url = payload?.url;
    if (typeof url !== 'string') throw new Error('url is required');
    if (!ALLOWED_URL_PREFIXES.some((p) => url.startsWith(p))) {
      throw new Error('only http(s) urls are allowed');
    }
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC_CHANNELS.APP_OPEN_LOGS, async () => {
    await shell.openPath(logsDir());
  });

  ipcMain.handle(IPC_CHANNELS.APP_EXPORT_LOG, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const opts = {
      title: 'Export log',
      defaultPath: `lolzteam-launcher-${stamp}.log`,
      filters: [{ name: 'Log', extensions: ['log'] }],
    };
    const result = win
      ? await dialog.showSaveDialog(win, opts)
      : await dialog.showSaveDialog(opts);
    if (result.canceled || !result.filePath) return { ok: false };
    await copyFile(logFile(), result.filePath);
    return { ok: true, path: result.filePath };
  });
};
