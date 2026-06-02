import { ipcMain } from 'electron';
import { IPC_CHANNELS, type IpcRequestMap } from '@shared-ipc';
import { testProxy } from '../services/proxy';

export const registerProxyIpc = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.PROXY_TEST,
    (_e, input: IpcRequestMap[typeof IPC_CHANNELS.PROXY_TEST]) => testProxy(input),
  );
};
