import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared-ipc';
import type { AuthStatus } from '@shared-types';
import { clearToken, loadToken, onTokenChange } from '../auth/token-store';
import { fetchProfile } from '../services/market';

const buildStatus = async (): Promise<AuthStatus> => {
  const token = await loadToken();
  if (!token) return { authenticated: false, session: null };
  const session = await fetchProfile();
  return {
    authenticated: Boolean(session),
    session,
  };
};

const broadcast = (channel: string, payload: unknown) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
};

export const registerAuthIpc = () => {
  ipcMain.handle(IPC_CHANNELS.AUTH_GET_STATUS, () => buildStatus());

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    await clearToken();
  });

  onTokenChange(async () => {
    broadcast(IPC_CHANNELS.AUTH_STATUS_CHANGED, await buildStatus());
  });
};
