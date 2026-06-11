import type { AccountScope, AccountSummary, ServiceId } from '@shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useAccountsLoading } from './accountsLoading';

export const STREAM_SERVICES = [
  'steam',
  'telegram',
  'tiktok',
  'instagram',
  'discord',
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
  loaded: ReadonlySet<StreamKey>;
  streamed: Map<StreamKey, AccountSummary[]>;
  progress: StreamProgress | null;
  setStreaming: (streaming: boolean) => void;
  setLoaded: (updater: (prev: ReadonlySet<StreamKey>) => ReadonlySet<StreamKey>) => void;
  setProgress: (progress: StreamProgress | null) => void;
  resetAccumulator: () => void;
  reset: () => void;
}

export const useAccountsStream = create<AccountsStreamState>((set) => ({
  streaming: false,
  loaded: new Set(),
  streamed: new Map(),
  progress: null,
  setStreaming: (streaming) => set({ streaming }),
  setLoaded: (updater) => set((s) => ({ loaded: updater(s.loaded) })),
  setProgress: (progress) => set({ progress }),
  resetAccumulator: () => set({ streamed: new Map() }),
  reset: () => set({ streaming: false, loaded: new Set(), streamed: new Map(), progress: null }),
}));

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

export const startAccountsStream = (only?: StreamService, scope: AccountScope = 'purchased') => {
  const st = useAccountsStream.getState();
  if (st.streaming) return;
  st.setStreaming(true);
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
  void window.launcher.accounts.listStream(only, scope).catch(() => st.setStreaming(false));
};

export const useAccountsStreamController = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const rebuild = () =>
      qc.setQueryData<AccountSummary[]>(['accounts'], (prev) => mergeWithStream(prev ?? []));

    const off = window.launcher.accounts.onCategory(
      ({ serviceId, scope, items, categoryDone, done, page, totalPages }) => {
        const st = useAccountsStream.getState();
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
        }
      },
    );

    let cancelled = false;
    void window.launcher.accounts.list().then((cached) => {
      if (cancelled) return;
      const hasPurchased = cached.some((it) => scopeOf(it) === 'purchased');
      if (hasPurchased) {
        // Mark the purchased scope as already loaded from cache.
        useAccountsStream
          .getState()
          .setLoaded(() => new Set(STREAM_SERVICES.map((id) => streamKey('purchased', id))));
      } else {
        startAccountsStream();
      }
    });

    return () => {
      cancelled = true;
      off();
    };
  }, [qc]);

  const streaming = useAccountsStream((st) => st.streaming);
  useEffect(() => {
    useAccountsLoading.getState().setLoading(streaming);
    return () => useAccountsLoading.getState().setLoading(false);
  }, [streaming]);
};
