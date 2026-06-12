import { IPC_CHANNELS } from '@shared-ipc';
import type { AccountsCategoryEvent } from '@shared-ipc';
import { SERVICE_CATEGORY_ID } from '@shared-types';
import type { AccountScope, AccountSummary, ServiceId } from '@shared-types';
import { type IpcMainInvokeEvent, ipcMain } from 'electron';
import { onTokenChange } from '../auth/token-store';
import {
  clearCachedAccounts,
  loadCachedAccounts,
  saveCachedAccounts,
} from '../services/accounts-cache-store';
import {
  addItemTag,
  checkAccountValidity,
  getAccountDetails,
  listAccountsByCategory,
  listPurchasedAccounts,
  removeItemTag,
} from '../services/market';

const STREAM_ORDER: readonly ServiceId[] = [
  'steam',
  'telegram',
  'tiktok',
  'instagram',
  'discord',
] as const;

let inflight: Promise<AccountSummary[]> | null = null;

const fetchAndCache = (): Promise<AccountSummary[]> => {
  if (inflight) return inflight;
  const p = listPurchasedAccounts()
    .then(async (items) => {
      // Replace only the purchased slice; keep any cached listed items.
      const cached = (await loadCachedAccounts())?.items ?? [];
      const kept = cached.filter((it) => (it.scope ?? 'purchased') !== 'purchased');
      await saveCachedAccounts([...kept, ...items]);
      return items;
    })
    .finally(() => {
      inflight = null;
    });
  inflight = p;
  return p;
};

const loadCached = async (): Promise<AccountSummary[]> => {
  const cached = await loadCachedAccounts();
  return cached?.items ?? [];
};

let activeStream: AbortController | null = null;

export const cancelAccountsStream = (): void => {
  activeStream?.abort();
  activeStream = null;
};

const streamCategories = async (
  event: IpcMainInvokeEvent,
  only?: ServiceId,
  scope: AccountScope = 'purchased',
  streamId = 0,
): Promise<void> => {
  activeStream?.abort();
  const controller = new AbortController();
  activeStream = controller;
  const { signal } = controller;

  const alive = () => activeStream === controller && !signal.aborted;
  const send = (payload: Omit<AccountsCategoryEvent, 'streamId'>) => {
    if (alive() && !event.sender.isDestroyed()) {
      event.sender.send(IPC_CHANNELS.ACCOUNTS_CATEGORY, { streamId, ...payload });
    }
  };
  // When a single category is requested, stream only it and replace just its
  // slice of the cache. Otherwise stream the full fixed order for this scope.
  const target = only !== undefined && STREAM_ORDER.includes(only) ? only : undefined;
  const order: readonly ServiceId[] = target ? [target] : STREAM_ORDER;
  const all: AccountSummary[] = [];
  let unfiltered: AccountSummary[] | null = null;
  const getUnfiltered = async (): Promise<AccountSummary[]> => {
    if (unfiltered === null) unfiltered = await listPurchasedAccounts(scope, signal);
    return unfiltered;
  };
  const scopeOf = (it: AccountSummary): AccountScope => it.scope ?? 'purchased';
  try {
    for (const serviceId of order) {
      if (!alive()) return;
      const categoryId = SERVICE_CATEGORY_ID[serviceId];
      if (categoryId === undefined) {
        const items = (await getUnfiltered()).filter((it) => it.category === serviceId);
        all.push(...items);
        if (items.length > 0) send({ serviceId, scope, items, categoryDone: false, done: false });
        send({ serviceId, scope, items: [], categoryDone: true, done: false });
        continue;
      }
      await listAccountsByCategory(
        categoryId,
        scope,
        (pageItems, progress) => {
          all.push(...pageItems);
          send({
            serviceId,
            scope,
            items: pageItems,
            categoryDone: false,
            done: false,
            page: progress.page,
            totalPages: progress.totalPages,
          });
        },
        signal,
      );
      if (!alive()) return;
      send({ serviceId, scope, items: [], categoryDone: true, done: false });
    }
    if (!alive()) return;
    const cached = (await loadCachedAccounts())?.items ?? [];
    if (target) {
      // Replace just this scope+category slice; keep everything else.
      const kept = cached.filter((it) => !(scopeOf(it) === scope && it.category === target));
      await saveCachedAccounts([...kept, ...all]);
    } else {
      // Replace the whole scope; keep the other scope's items.
      const kept = cached.filter((it) => scopeOf(it) !== scope);
      await saveCachedAccounts([...kept, ...all]);
    }
    const last = order[order.length - 1] as ServiceId;
    send({ serviceId: last, scope, items: [], categoryDone: true, done: true });
  } finally {
    if (activeStream === controller) {
      activeStream = null;
    }
  }
};

const toItemId = (payload?: { itemId?: unknown }): number => {
  const id = Number(payload?.itemId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('invalid itemId');
  return id;
};

const toTagId = (payload?: { tagId?: unknown }): number => {
  const id = Number(payload?.tagId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('invalid tagId');
  return id;
};

export const registerAccountsIpc = () => {
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_LIST, () => loadCached());
  ipcMain.handle(
    IPC_CHANNELS.ACCOUNTS_LIST_STREAM,
    (event, payload?: { only?: ServiceId; scope?: AccountScope; streamId?: number }) =>
      streamCategories(event, payload?.only, payload?.scope ?? 'purchased', payload?.streamId ?? 0),
  );
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_REFRESH, () => fetchAndCache());
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_CLEAR_CACHE, async () => {
    inflight = null;
    await clearCachedAccounts();
  });
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_GET, (_e, payload?: { itemId: number }) =>
    getAccountDetails(toItemId(payload)),
  );
  ipcMain.handle(IPC_CHANNELS.ACCOUNT_CHECK, (_e, payload?: { itemId: number }) =>
    checkAccountValidity(toItemId(payload)),
  );
  ipcMain.handle(IPC_CHANNELS.ACCOUNT_ADD_TAG, (_e, payload?: { itemId: number; tagId: number }) =>
    addItemTag(toItemId(payload), toTagId(payload)),
  );
  ipcMain.handle(
    IPC_CHANNELS.ACCOUNT_REMOVE_TAG,
    (_e, payload?: { itemId: number; tagId: number }) =>
      removeItemTag(toItemId(payload), toTagId(payload)),
  );

  onTokenChange(() => {
    inflight = null;
    cancelAccountsStream();
    void clearCachedAccounts();
  });
};
