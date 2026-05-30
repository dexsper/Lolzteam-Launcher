import { app, ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '@shared-ipc';

const ALLOWED_URL_PREFIXES = ['https://', 'http://'];

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
};
