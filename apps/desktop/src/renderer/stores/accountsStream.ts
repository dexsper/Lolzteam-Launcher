import type { AccountScope, AccountSummary, LauncherSettings, ServiceId } from '@shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useAccountsLoading } from './accountsLoading';
import { useSettings } from './settings';

export const STREAM_SERVICES = [
  'steam',
  'telegram',
  'tiktok',
  'instagram',
  'discord',
  'llm',
] as const satisfies readonly ServiceId[];
export type StreamService = (typeof STREAM_SERVICES)[number];

export const isStreamService = (id: ServiceId | null): id is StreamService =>
  id !== null && (STREAM_SERVICES as readonly string[]).includes(id);

// Accumulators are keyed by scope+service so the two scopes (purchased/listed)
// stream and cache independently.
type StreamKey = `${AccountScope}:${StreamService}`;
const streamKey = (scope: AccountScope, service: StreamService): StreamKey => `${scope}:${service}`;
const scopeOf = (it: AccountSummary): AccountScope => it.scope ?? 'purchased';

export interface StreamProgress {
  service: StreamService;
  page: number;
  totalPages: number | null;
  count: number;
}

interface AccountsStreamState {
  streaming: boolean;
  streamId: number;
  activeScope: AccountScope;
  launchHandled: boolean;
  preloadScope: AccountScope | null;
  loaded: ReadonlySet<StreamKey>;
  streamed: Map<StreamKey, AccountSummary[]>;
  progress: StreamProgress | null;
  setStreaming: (streaming: boolean) => void;
  setStreamId: (streamId: number) => void;
  setActiveScope: (scope: AccountScope) => void;
  setLaunchHandled: (launchHandled: boolean) => void;
  setPreloadScope: (scope: AccountScope | null) => void;
  setLoaded: (updater: (prev: ReadonlySet<StreamKey>) => ReadonlySet<StreamKey>) => void;
  setProgress: (progress: StreamProgress | null) => void;
  resetAccumulator: () => void;
  reset: () => void;
}

export const useAccountsStream = create<AccountsStreamState>((set) => ({
  streaming: false,
  streamId: 0,
  activeScope: 'purchased',
  launchHandled: false,
  preloadScope: null,
  loaded: new Set(),
  streamed: new Map(),
  progress: null,
  setStreaming: (streaming) => set({ streaming }),
  setStreamId: (streamId) => set({ streamId }),
  setActiveScope: (activeScope) => set({ activeScope }),
  setLaunchHandled: (launchHandled) => set({ launchHandled }),
  setPreloadScope: (preloadScope) => set({ preloadScope }),
  setLoaded: (updater) => set((s) => ({ loaded: updater(s.loaded) })),
  setProgress: (progress) => set({ progress }),
  resetAccumulator: () => set({ streamed: new Map() }),
  reset: () =>
    set({
      streaming: false,
      preloadScope: null,
      loaded: new Set(),
      streamed: new Map(),
      progress: null,
    }),
}));

let streamSeq = 0;

/** Has this scope finished streaming all its categories? */
export const isScopeLoaded = (loaded: ReadonlySet<StreamKey>, scope: AccountScope): boolean =>
  STREAM_SERVICES.every((id) => loaded.has(streamKey(scope, id)));

export const mergeWithStream = (base: AccountSummary[]): AccountSummary[] => {
  const touched = useAccountsStream.getState().streamed;
  const keys = new Set(touched.keys());
  const kept = base.filter(
    (it) => !(isStreamService(it.category) && keys.has(streamKey(scopeOf(it), it.category))),
  );
  return [...kept, ...[...touched.values()].flat()];
};

export const startAccountsStream = (
  only?: StreamService,
  scope: AccountScope = 'purchased',
  opts?: { keepActiveScope?: boolean },
) => {
  const st = useAccountsStream.getState();
  if (st.streaming) return;
  const id = ++streamSeq;
  st.setStreaming(true);
  st.setStreamId(id);
  if (!opts?.keepActiveScope) st.setActiveScope(scope);
  st.setProgress(null);
  if (only) {
    const key = streamKey(scope, only);
    st.setLoaded((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    st.streamed.delete(key);
  } else {
    // Re-stream the whole scope: drop just this scope's keys, keep the other's.
    st.setLoaded((prev) => {
      const next = new Set(prev);
      for (const k of next) if (k.startsWith(`${scope}:`)) next.delete(k);
      return next;
    });
    for (const k of [...st.streamed.keys()]) if (k.startsWith(`${scope}:`)) st.streamed.delete(k);
  }
  void window.launcher.accounts.listStream(only, scope, id).catch(() => {
    if (useAccountsStream.getState().streamId === id)
      useAccountsStream.getState().setStreaming(false);
  });
};

export const restartAccountsStream = (scope?: AccountScope) => {
  const st = useAccountsStream.getState();
  const target = scope ?? st.activeScope;
  st.setStreaming(false);
  startAccountsStream(undefined, target);
};

const appProxySignature = (settings: LauncherSettings): string => {
  const p = settings.appProxyId
    ? settings.proxies.find((x) => x.id === settings.appProxyId)
    : undefined;
  return p
    ? `${p.protocol ?? 'http'}://${p.host}:${p.port}:${p.username ?? ''}:${p.password ?? ''}`
    : 'direct';
};

export const useAccountsStreamController = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const rebuild = () =>
      qc.setQueryData<AccountSummary[]>(['accounts'], (prev) => mergeWithStream(prev ?? []));

    const off = window.launcher.accounts.onCategory(
      ({ streamId, serviceId, scope, items, categoryDone, done, page, totalPages }) => {
        const st = useAccountsStream.getState();
        if (streamId !== st.streamId) return;
        if (!isStreamService(serviceId)) {
          if (done) {
            st.setStreaming(false);
            st.setProgress(null);
          }
          return;
        }
        const key = streamKey(scope, serviceId);
        if (items.length > 0) {
          const acc = st.streamed.get(key) ?? [];
          acc.push(...items);
          st.streamed.set(key, acc);
          rebuild();
        }
        if (!categoryDone && page !== undefined) {
          st.setProgress({
            service: serviceId,
            page,
            totalPages: totalPages ?? null,
            count: (st.streamed.get(key) ?? []).length,
          });
        }
        if (categoryDone) {
          if (!st.streamed.has(key)) {
            st.streamed.set(key, []);
            rebuild();
          }
          st.setLoaded((prev) => new Set(prev).add(key));
        }
        if (done) {
          st.setStreaming(false);
          st.setProgress(null);
          const next = useAccountsStream.getState().preloadScope;
          if (next && next !== scope) {
            useAccountsStream.getState().setPreloadScope(null);
            if (!isScopeLoaded(useAccountsStream.getState().loaded, next))
              startAccountsStream(undefined, next, { keepActiveScope: true });
          } else if (next) {
            useAccountsStream.getState().setPreloadScope(null);
          }
        }
      },
    );

    let cancelled = false;
    if (!useAccountsStream.getState().launchHandled) {
      void window.launcher.settings.get().then((settingsResp) => {
        if (cancelled || useAccountsStream.getState().launchHandled) return;
        const refreshOnLaunch = settingsResp.settings.refreshOnLaunch ?? true;
        if (refreshOnLaunch) {
          useAccountsStream.getState().setPreloadScope('listed');
          startAccountsStream(undefined, 'purchased');
        } else {
          useAccountsStream
            .getState()
            .setLoaded(
              () =>
                new Set([
                  ...STREAM_SERVICES.map((id) => streamKey('purchased', id)),
                  ...STREAM_SERVICES.map((id) => streamKey('listed', id)),
                ]),
            );
        }
        useAccountsStream.getState().setLaunchHandled(true);
      });
    }

    return () => {
      cancelled = true;
      off();
    };
  }, [qc]);

  const bgMinutes = useSettings((s) => s.settings?.backgroundRefreshMinutes ?? 0);
  useEffect(() => {
    if (!bgMinutes || bgMinutes <= 0) return;
    const id = setInterval(() => {
      if (!useAccountsStream.getState().streaming) restartAccountsStream();
    }, bgMinutes * 60_000);
    return () => clearInterval(id);
  }, [bgMinutes]);

  useEffect(() => {
    const sigOf = (s: LauncherSettings | null): string | null => (s ? appProxySignature(s) : null);
    let prev = sigOf(useSettings.getState().settings);
    const unsub = useSettings.subscribe((state) => {
      const sig = sigOf(state.settings);
      if (sig === null) return;
      if (prev === null) {
        prev = sig;
        return;
      }
      if (sig === prev) return;
      prev = sig;
      void window.launcher.accounts.clearCache().then(() => {
        const st = useAccountsStream.getState();
        st.reset();
        qc.setQueryData<AccountSummary[]>(['accounts'], []);
        restartAccountsStream();
      });
    });
    return unsub;
  }, [qc]);

  const streaming = useAccountsStream((st) => st.streaming);
  useEffect(() => {
    useAccountsLoading.getState().setLoading(streaming);
    return () => useAccountsLoading.getState().setLoading(false);
  }, [streaming]);
};
