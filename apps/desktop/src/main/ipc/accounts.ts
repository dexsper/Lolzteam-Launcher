import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared-ipc';
import { getAccountDetails, listPurchasedAccounts } from '../services/market';
import {
  clearCachedAccounts,
  loadCachedAccounts,
  saveCachedAccounts,
} from '../services/accounts-cache-store';
import { onTokenChange } from '../auth/token-store';
import type { AccountSummary } from '@shared-types';

let inflight: Promise<AccountSummary[]> | null = null;

const fetchAndCache = (): Promise<AccountSummary[]> => {
  if (inflight) return inflight;
  const p = listPurchasedAccounts()
    .then(async (items) => {
      // Don't clobber a good cache with an empty list — listPurchasedAccounts
      // returns [] on transient network errors too, not just genuine emptiness.
      if (items.length > 0) await saveCachedAccounts(items);
      return items;
    })
    .finally(() => {
      inflight = null;
    });
  inflight = p;
  return p;
};

const load = async (force: boolean): Promise<AccountSummary[]> => {
  if (!force) {
    const cached = await loadCachedAccounts();
    if (cached) {
      // Serve instantly from disk, refresh in the background for next time.
      void fetchAndCache().catch(() => {});
      return cached.items;
    }
  }
  return fetchAndCache();
};

export const registerAccountsIpc = () => {
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_LIST, () => load(false));
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_REFRESH, () => load(true));
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_CLEAR_CACHE, async () => {
    inflight = null;
    await clearCachedAccounts();
  });
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_GET, (_e, payload: { itemId: number }) =>
    getAccountDetails(payload.itemId),
  );

  onTokenChange(() => {
    inflight = null;
    void clearCachedAccounts();
  });
};
