import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowDownUp, RefreshCw, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AccountSummary, ServiceId } from '@shared-types';
import { AccountCard } from './AccountCard';
import { InventorySkeleton } from './InventorySkeleton';
import s from './InventoryView.module.scss';

// How many cards to reveal initially and append each time the user scrolls
// to the bottom. Keeps the mounted card count small for snappy tab switches.
const CHUNK = 24;

// Only services with a working adapter are surfaced in the UI. Anything else
// is hidden — buyers can still see those items on lzt.market itself, but the
// launcher can't actually log into them, so showing them only invites confusion.
const SUPPORTED_SERVICES: readonly ServiceId[] = [
  'steam',
  'telegram',
  'tiktok',
  'instagram',
] as const;
const isSupportedService = (id: ServiceId | null): id is ServiceId =>
  id !== null && (SUPPORTED_SERVICES as readonly string[]).includes(id);

type Filter = ServiceId | 'all';

type SortKey = 'purchased' | 'price' | 'warranty';
type SortDir = 'asc' | 'desc';

const SORT_KEYS: readonly SortKey[] = ['purchased', 'price', 'warranty'] as const;

// Build a lowercase haystack of everything a buyer might type to find an account.
const searchHaystack = (item: AccountSummary): string => {
  const parts: (string | null | undefined)[] = [
    item.title,
    item.categoryTitle,
    item.steam?.country,
    item.telegram?.country,
    item.telegram?.username,
    item.telegram?.phone,
    ...(item.steam?.games.map((g) => g.title) ?? []),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
};

const matchesQuery = (item: AccountSummary, query: string): boolean => {
  if (!query) return true;
  const haystack = searchHaystack(item);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
};

// Sort comparators. Missing values sort last regardless of direction.
const sortValue = (item: AccountSummary, key: SortKey): number | null => {
  switch (key) {
    case 'purchased':
      return item.purchasedAt;
    case 'price':
      return item.price;
    case 'warranty':
      return item.warrantyEndsAt;
  }
};

const compareItems = (
  a: AccountSummary,
  b: AccountSummary,
  key: SortKey,
  dir: SortDir,
): number => {
  const va = sortValue(a, key);
  const vb = sortValue(b, key);
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  return dir === 'asc' ? va - vb : vb - va;
};

interface Bucket {
  id: Filter;
  label: string;
  count: number;
}

const buildBuckets = (
  items: AccountSummary[],
  allLabel: string,
): Bucket[] => {
  const counts = new Map<ServiceId, number>();
  for (const item of items) {
    if (isSupportedService(item.category)) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const buckets: Bucket[] = [{ id: 'all', label: allLabel, count: total }];
  for (const [id, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const sample = items.find((it) => it.category === id);
    buckets.push({ id, label: sample?.categoryTitle ?? id, count });
  }
  return buckets;
};

export const InventoryView = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('purchased');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [limit, setLimit] = useState(CHUNK);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['accounts'],
    queryFn: () => window.launcher.accounts.list(),
    staleTime: 60_000,
  });

  const rawItems = query.data ?? [];
  const items = useMemo(
    () => rawItems.filter((it) => isSupportedService(it.category)),
    [rawItems],
  );
  const buckets = useMemo(
    () => buildBuckets(items, t('inventory.filter.all')),
    [items, t],
  );

  const trimmedSearch = search.trim();
  const visible = useMemo(() => {
    const filtered = items.filter(
      (it) =>
        (filter === 'all' || it.category === filter) &&
        matchesQuery(it, trimmedSearch),
    );
    return [...filtered].sort((a, b) => compareItems(a, b, sortKey, sortDir));
  }, [items, filter, trimmedSearch, sortKey, sortDir]);

  // Reset the reveal window whenever the filter/search/sort changes.
  useEffect(() => {
    setLimit(CHUNK);
    document.querySelector('[data-scroll-root]')?.scrollTo({ top: 0 });
  }, [filter, trimmedSearch, sortKey, sortDir]);

  const shown = visible.slice(0, limit);
  const hasMore = limit < visible.length;

  // Append the next chunk when the sentinel scrolls into view.
  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLimit((n) => n + CHUNK);
        }
      },
      { root: node.closest('[data-scroll-root]'), rootMargin: '400px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, visible.length]);

  const refresh = async () => {
    await window.launcher.accounts.refresh();
    await query.refetch();
  };

  // Show the skeleton on the first load AND whenever a fetch is in flight with
  // no data yet — otherwise the "empty" state flashes after login while the
  // background refetch (triggered by cache clear + query invalidation) runs.
  if (query.isLoading || (rawItems.length === 0 && query.isFetching)) {
    return <InventorySkeleton />;
  }

  if (query.isError) {
    return (
      <div className={s.state}>
        <AlertCircle size={28} className={s.danger} />
        <p>{t('inventory.error')}</p>
        <button type="button" className={s.retry} onClick={() => query.refetch()}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (rawItems.length === 0) {
    return (
      <div className={s.state}>
        <p>{t('inventory.empty')}</p>
        <button
          type="button"
          className={s.retry}
          onClick={() =>
            window.launcher.app.openExternal('https://lzt.market/orders')
          }
        >
          {t('inventory.openMarket')}
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={s.state}>
        <p>{t('inventory.emptyUnsupported')}</p>
        <button
          type="button"
          className={s.retry}
          onClick={() =>
            window.launcher.app.openExternal('https://lzt.market/orders')
          }
        >
          {t('inventory.openMarket')}
        </button>
      </div>
    );
  }

  return (
    <div className={s.view}>
      <div className={s.toolbar}>
        <div className={s.filters}>
          {buckets.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`${s.filter} ${filter === b.id ? s.filterActive : ''}`}
              onClick={() => setFilter(b.id)}
            >
              <span>{b.label}</span>
              <span className={s.filterCount}>{b.count}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={s.refresh}
          onClick={refresh}
          disabled={query.isFetching}
        >
          <RefreshCw size={14} className={query.isFetching ? s.spin : ''} />
          <span>{t('inventory.refresh')}</span>
        </button>
      </div>

      <div className={s.controls}>
        <div className={s.searchBox}>
          <Search size={15} className={s.searchIcon} />
          <input
            type="text"
            className={s.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('inventory.searchPlaceholder')}
          />
          {search && (
            <button
              type="button"
              className={s.searchClear}
              onClick={() => setSearch('')}
              aria-label={t('inventory.searchClear')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className={s.sort}>
          <div className={s.sortKeys}>
            {SORT_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`${s.sortBtn} ${sortKey === key ? s.sortBtnActive : ''}`}
                onClick={() => setSortKey(key)}
              >
                {t(`inventory.sort.${key}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={s.sortDir}
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title={t(sortDir === 'asc' ? 'inventory.sort.asc' : 'inventory.sort.desc')}
          >
            <ArrowDownUp size={14} />
            <span>{t(sortDir === 'asc' ? 'inventory.sort.asc' : 'inventory.sort.desc')}</span>
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className={s.noResults}>
          <Search size={24} className={s.noResultsIcon} />
          <p>{t('inventory.noResults')}</p>
        </div>
      ) : (
        <div key={filter} className={s.grid}>
          {shown.map((item) => (
            <AccountCard key={item.itemId} item={item} />
          ))}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className={s.sentinel} aria-hidden />}
    </div>
  );
};
