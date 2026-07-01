import { IPC_CHANNELS, type IpcRequestMap } from '@shared-ipc';
import { ipcMain } from 'electron';
import { fetchMarketProxies } from '../services/market';
import { testProxy } from '../services/proxy';

export const registerProxyIpc = (): void => {
  ipcMain.handle(
    IPC_CHANNELS.PROXY_TEST,
    (_e, input: IpcRequestMap[typeof IPC_CHANNELS.PROXY_TEST]) => testProxy(input),
  );

  ipcMain.handle(IPC_CHANNELS.PROXY_FETCH_MARKET, async () => {
    try {
      const proxies = await fetchMarketProxies();
      return { ok: true, proxies };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'fetch_failed' };
    }
  });
};
