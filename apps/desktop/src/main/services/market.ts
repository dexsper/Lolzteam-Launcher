import { MarketClient } from '@market-sdk';
import type { RawLetter, RawMarketItem, RawProfileResponse, RawUserTag } from '@market-sdk';
import { categoryIdToServiceId, categoryNameToServiceId, detectLlmService } from '@shared-types';
import type {
  AccountDetails,
  AccountScope,
  AccountSummary,
  AccountTag,
  AuthSession,
  MailLetter,
  MailLettersRequest,
  MailLettersResult,
  ServiceId,
  SteamGame,
  SteamInfo,
  TelegramInfo,
  UserLabel,
} from '@shared-types';
import { app } from 'electron';
import log from 'electron-log/main';
import { extractSharedSecret } from '../adapters/steam/mafile';
import { loadToken, onTokenChange } from '../auth/token-store';
import { appFetch } from './api-session';

let client: MarketClient | null = null;

const getClient = (): MarketClient => {
  if (!client) {
    client = new MarketClient({
      getToken: () => loadToken(),
      userAgent: `LolzteamLauncher/${app.getVersion?.() ?? '0.0.0'} (+desktop)`,
      fetch: appFetch,
    });
  }
  return client;
};

// Bumped on every token change (login/logout). In-flight pagination captures
// the epoch at start and bails between pages when it changes, so a stale loop
// can't fire a request with a cleared/replaced token (→ spurious 401).
let tokenEpoch = 0;

onTokenChange(() => {
  client = null;
  tokenEpoch += 1;
});

const pickAvatarUrl = (user: RawProfileResponse['user']): string | null =>
  user.rendered?.avatars?.l ??
  user.rendered?.avatars?.m ??
  user.rendered?.avatars?.s ??
  user.links?.avatar_big ??
  user.links?.avatar ??
  user.avatar_url ??
  null;

const pickUsernameHtml = (user: RawProfileResponse['user']): string | null => {
  const html = user.rendered?.username;
  return typeof html === 'string' && html.trim() ? html : null;
};

const parseBalance = (value: number | string | undefined): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const normalizeProfile = (raw: RawProfileResponse): AuthSession => ({
  userId: raw.user.user_id,
  username: raw.user.username,
  usernameHtml: pickUsernameHtml(raw.user),
  avatarUrl: pickAvatarUrl(raw.user),
  profileUrl: raw.user.view_url ?? raw.user.links?.permalink ?? null,
  // `convertedBalance` is the spendable balance already in the selected currency;
  // the raw `balance` is in a base unit and shouldn't be shown as-is.
  balance: parseBalance(raw.user.convertedBalance ?? raw.user.balance),
  // Forum API gives a lowercase code ("rub"); uppercase it for display/Intl.
  currency: typeof raw.user.currency === 'string' ? raw.user.currency.toUpperCase() : null,
});

export const fetchProfile = async (): Promise<AuthSession | null> => {
  const result = await fetchProfileResult();
  return result.kind === 'ok' ? result.session : null;
};

export type ProfileResult =
  | { kind: 'ok'; session: AuthSession }
  | { kind: 'offline' }
  | { kind: 'unauthorized' };

const httpStatusOf = (err: unknown): number | null => {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { status?: number } }).response;
    if (res && typeof res.status === 'number') return res.status;
  }
  return null;
};

const isAuthRejection = (err: unknown): boolean => {
  const status = httpStatusOf(err);
  return status === 401 || status === 403;
};

const isAbortError = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));

export const fetchProfileResult = async (): Promise<ProfileResult> => {
  const token = await loadToken();
  if (!token) return { kind: 'unauthorized' };
  // Market `/me` returns rendered avatars + gradient username HTML + balance in
  // one call. Fall back to the forum `/users/me` shape if it ever lacks a user.
  try {
    const raw = await getClient().me();
    if (raw?.user) return { kind: 'ok', session: normalizeProfile(raw) };
    log.warn('[market] me() returned no user; falling back to forum profile');
  } catch (err) {
    if (isAuthRejection(err)) return { kind: 'unauthorized' };
    log.warn('[market] me() failed; falling back to forum profile', err);
  }
  try {
    const raw = await getClient().meForum();
    if (raw?.user) return { kind: 'ok', session: normalizeProfile(raw) };
  } catch (err) {
    if (isAuthRejection(err)) return { kind: 'unauthorized' };
    log.warn('[market] fetchProfile fallback failed', err);
  }
  return { kind: 'offline' };
};

const asNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// XenForo flags arrive as 0/1 ints (sometimes strings). Treat any truthy
// non-zero numeric as "on".
const asFlag = (v: unknown): boolean => {
  const n = asNumber(v);
  return n !== null && n !== 0;
};

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

// The market sends Telegram country as an ISO alpha-2 code but Steam country as
// a full English name ("Ukraine"). Build a reverse English-name → ISO lookup
// once so SteamInfo.country is normalized to the same ISO codes the UI expects
// for flag rendering. Codes that don't resolve fall through to null.
const ENGLISH_REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

const buildCountryNameToIso = (): Map<string, string> => {
  const map = new Map<string, string>();
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      let name: string | undefined;
      try {
        name = ENGLISH_REGION_NAMES.of(code);
      } catch {
        name = undefined;
      }
      // `of` echoes the input code back when it isn't a real region.
      if (name && name !== code) map.set(name.toLowerCase(), code);
    }
  }
  return map;
};

const COUNTRY_NAME_TO_ISO = buildCountryNameToIso();

// Returns an ISO alpha-2 code given either an ISO code or an English country
// name; null when it can't be resolved.
const toIsoCountry = (value: unknown): string | null => {
  const raw = asString(value);
  if (!raw) return null;
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  return COUNTRY_NAME_TO_ISO.get(raw.toLowerCase()) ?? null;
};

const extractTags = (item: RawMarketItem): AccountTag[] => {
  const tags = item.tags;
  if (!tags || typeof tags !== 'object') return [];
  const out: AccountTag[] = [];
  for (const entry of Object.values(tags as Record<string, unknown>)) {
    if (entry && typeof entry === 'object') {
      const id = asNumber((entry as { tag_id?: unknown }).tag_id);
      const title = asString((entry as { title?: unknown }).title)?.trim();
      const bc = asString((entry as { bc?: unknown }).bc)?.trim();
      if (id !== null && title) out.push(bc ? { id, title, bc } : { id, title });
    }
  }
  return out;
};

interface SteamBans {
  vacBanned: boolean;
  communityBanned: boolean;
  tradeBanned: boolean;
}

const extractSteamBans = (item: RawMarketItem): SteamBans => {
  const bans = item.steam_bans;
  const obj = bans && typeof bans === 'object' ? (bans as Record<string, unknown>) : null;

  const vacBanned =
    asFlag(item.steam_vac) ||
    (obj ? asFlag(obj.VACBanned) || (asNumber(obj.NumberOfVACBans) ?? 0) > 0 : false);

  const communityBanned =
    asFlag(item.steam_community_ban) || (obj ? asFlag(obj.CommunityBanned) : false);

  const tradeBanned =
    asFlag(item.steam_trade_ban) ||
    (obj ? asString(obj.EconomyBan) !== null && asString(obj.EconomyBan) !== 'none' : false);

  return { vacBanned, communityBanned, tradeBanned };
};

const RESOLD_TAG_TITLES = new Set(['перепродан', 'resold']);

const isResold = (item: RawMarketItem): boolean =>
  extractTags(item).some((tag) => RESOLD_TAG_TITLES.has(tag.title.trim().toLowerCase()));

// Top games by hours played. Icons resolve from parentGameId on the FE CDN.
const extractSteamGames = (item: RawMarketItem, max = 6): SteamGame[] => {
  const full = item.steam_full_games;
  const list = full && typeof full === 'object' ? (full as { list?: unknown }).list : null;
  if (!list || typeof list !== 'object') return [];
  const games: SteamGame[] = [];
  for (const raw of Object.values(list as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const g = raw as Record<string, unknown>;
    const appId = asNumber(g.appid);
    const parentGameId = asNumber(g.parentGameId) ?? appId;
    const title = asString(g.abbr) ?? asString(g.title);
    if (appId === null || parentGameId === null || !title) continue;
    games.push({
      appId,
      parentGameId,
      title,
      hours: asNumber(g.playtime_forever) ?? 0,
    });
  }
  games.sort((a, b) => b.hours - a.hours);
  return games.slice(0, max);
};

// Steam items expose a rich set of `steam_*` fields plus `tags`/origin. We surface
// a compact, display-ready subset; missing fields degrade to null/false so the
// list endpoint (which may omit some) still renders cleanly.
const extractSteamInfo = (item: RawMarketItem, serviceId: ServiceId | null): SteamInfo | null => {
  if (serviceId !== 'steam') return null;
  const bans = extractSteamBans(item);
  return {
    tags: extractTags(item),
    level: asNumber(item.steam_level),
    gameCount: asNumber(item.steam_game_count),
    hasMfa: asFlag(item.steam_mfa),
    isLimited: asFlag(item.steam_is_limited),
    lastActivity: asNumber(item.steam_last_activity),
    vacBanned: bans.vacBanned,
    communityBanned: bans.communityBanned,
    tradeBanned: bans.tradeBanned,
    balance: asString(item.steam_balance),
    origin: asString(item.itemOriginPhrase),
    country: toIsoCountry(item.steam_country),
    games: extractSteamGames(item),
  };
};

const extractTelegramInfo = (
  item: RawMarketItem,
  serviceId: ServiceId | null,
): TelegramInfo | null => {
  if (serviceId !== 'telegram') return null;
  return {
    phone: asString(item.telegram_phone),
    username: asString(item.telegram_username),
    id: asNumber(item.telegram_id),
    country: asString(item.telegram_country),
    lastSeen: asNumber(item.telegram_last_seen),
    premium: asFlag(item.telegram_premium),
    premiumExpires: asNumber(item.telegram_premium_expires),
    // -1 means "unknown/not checked"; anything > 0 is an active block.
    spamBlocked: (asNumber(item.telegram_spam_block) ?? -1) > 0,
    tags: extractTags(item),
    origin: asString(item.itemOriginPhrase),
    channelsCount: asNumber(item.telegram_channels_count),
    chatsCount: asNumber(item.telegram_chats_count),
    contactsCount: asNumber(item.telegram_contacts_count),
  };
};

// `buyer.operation_date` (when present) is when the current viewer purchased the
// item. Fall back to null so the card can hide the line.
const extractPurchasedAt = (item: RawMarketItem): number | null => {
  const buyer = item.buyer;
  if (buyer && typeof buyer === 'object') {
    const date = asNumber((buyer as { operation_date?: unknown }).operation_date);
    if (date) return date;
  }
  return null;
};

const pickCategoryRaw = (item: RawMarketItem): string => {
  const cat = item.category;
  return (cat?.name ?? cat?.category_name ?? item.category_name ?? '').toString();
};

const pickCategoryTitle = (item: RawMarketItem): string => {
  const cat = item.category;
  return (
    cat?.title ??
    cat?.category_title ??
    item.category_title ??
    pickCategoryRaw(item) ??
    'Unknown'
  ).toString();
};

const normalizeItem = (item: RawMarketItem, scope: AccountScope): AccountSummary => {
  const categoryRaw = pickCategoryRaw(item);
  // Resolve by name first; fall back to the numeric category id so a category
  // with an unexpected name string (e.g. LLM, id 6) still maps to its service.
  const category = categoryNameToServiceId(categoryRaw) ?? categoryIdToServiceId(item.category_id);
  return {
    itemId: item.item_id,
    category,
    categoryRaw,
    categoryTitle: pickCategoryTitle(item),
    title: item.title ?? item.title_en ?? `#${item.item_id}`,
    description: item.description ?? '',
    price: item.price ?? 0,
    currency: item.price_currency ?? 'RUB',
    imageUrl: item.item_image_url ?? item.item_image ?? null,
    tags: extractTags(item),
    warrantyEndsAt: item.warranty_end_at ?? null,
    publishedAt: item.published_date ?? null,
    purchasedAt: extractPurchasedAt(item),
    isPurchased: item.item_state === 'paid' || item.item_state === 'closed',
    scope,
    steam: extractSteamInfo(item, category),
    telegram: extractTelegramInfo(item, category),
    llmService:
      category === 'llm'
        ? detectLlmService(
            typeof item.llm_service === 'string' ? item.llm_service : null,
            item.title,
            item.title_en,
            item.description,
          )
        : null,
    hasEmailLogin: Boolean(
      item.emailLoginData?.login ||
        item.email_login_data?.login ||
        item.canViewEmailLoginData ||
        item.can_view_email_login_data,
    ),
  };
};

type PageProgress = { page: number; totalPages: number | null };
type OnPage = (items: AccountSummary[], progress: PageProgress) => void;

// 'purchased' reads the user's orders; 'listed' reads their own active listings.
const fetchPage = (scope: AccountScope, page: number, categoryId?: number, signal?: AbortSignal) =>
  scope === 'listed'
    ? getClient().listUser({ page, categoryId, show: 'active' }, signal)
    : getClient().listOrders({ page, categoryId }, signal);

const paginate = async (
  scope: AccountScope,
  categoryId?: number,
  onPage?: OnPage,
  signal?: AbortSignal,
): Promise<AccountSummary[]> => {
  const epoch = tokenEpoch;
  const out: AccountSummary[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext && page <= 50) {
    if (tokenEpoch !== epoch || signal?.aborted) break;
    const resp = await fetchPage(scope, page, categoryId, signal);
    const items = resp.items ?? [];
    // Resold items only appear among purchases; own listings are kept as-is.
    const visible = scope === 'listed' ? items : items.filter((it) => !isResold(it));
    const normalized = visible.map((it) => normalizeItem(it, scope));
    out.push(...normalized);
    const perPage = resp.perPage || items.length;
    const totalPages =
      perPage > 0 && resp.totalItems > 0 ? Math.ceil(resp.totalItems / perPage) : null;
    onPage?.(normalized, { page, totalPages });
    if (typeof resp.hasNextPage === 'boolean') {
      hasNext = resp.hasNextPage;
    } else {
      hasNext = items.length > 0 && perPage > 0 && page * perPage < resp.totalItems;
    }
    page += 1;
  }
  return out;
};

export const listPurchasedAccounts = async (
  scope: AccountScope = 'purchased',
  signal?: AbortSignal,
): Promise<AccountSummary[]> => {
  const token = await loadToken();
  if (!token) return [];
  try {
    return await paginate(scope, undefined, undefined, signal);
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) return [];
    log.warn(`[market] listPurchasedAccounts(${scope}) failed`, err);
    return [];
  }
};

export const listAccountsByCategory = async (
  categoryId: number,
  scope: AccountScope = 'purchased',
  onPage?: OnPage,
  signal?: AbortSignal,
): Promise<AccountSummary[]> => {
  const token = await loadToken();
  if (!token) return [];
  try {
    return await paginate(scope, categoryId, onPage, signal);
  } catch (err) {
    if (isAbortError(err) || signal?.aborted) return [];
    log.warn(`[market] listAccountsByCategory(${categoryId}, ${scope}) failed`, err);
    return [];
  }
};

export const fetchEmailCode = async (
  itemId: number,
  signal: AbortSignal,
): Promise<string | null> => {
  const token = await loadToken();
  if (!token) return null;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (signal.aborted) return null;
    try {
      const resp = await getClient().getEmailCode(itemId);
      if ('codeData' in resp && resp.codeData && typeof resp.codeData.code === 'string') {
        const code = resp.codeData.code.trim();
        if (code) return code;
      }
      const err = (resp as { error?: string }).error;
      if (err && err !== 'retry_request') {
        log.warn(`[market] getEmailCode returned error: ${err}`);
        return null;
      }
    } catch (err) {
      log.warn('[market] getEmailCode threw', err);
      return null;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
};

// Tag id 1 marks a "valid" account; only the invalid tag is checked below.
const INVALID_TAG_ID = 2;

export type CheckAccountResult =
  | { ok: true; valid: boolean; tags: AccountTag[]; reason?: string }
  | { ok: false; message: string };

const tagsToResult = (tags: AccountTag[], reason?: string): CheckAccountResult => {
  const valid = !tags.some((tag) => tag.id === INVALID_TAG_ID);
  return { ok: true, valid, tags, reason };
};

const fetchAuthoritativeTags = async (itemId: number): Promise<AccountTag[] | null> => {
  try {
    const resp = await getClient().getItem(itemId);
    if (resp?.item) return extractTags(resp.item);
  } catch (err) {
    log.warn(`[market] checkAccount getItem(${itemId}) failed`, err);
  }
  return null;
};

export const checkAccountValidity = async (itemId: number): Promise<CheckAccountResult> => {
  const token = await loadToken();
  if (!token) return { ok: false, message: 'not_authenticated' };
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const resp = await getClient().checkAccount(itemId);
      const errors = 'errors' in resp && Array.isArray(resp.errors) ? resp.errors : [];
      if (errors.includes('retry_request')) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const reason = typeof errors[0] === 'string' ? errors[0] : undefined;
      if (reason) log.warn(`[market] checkAccount(${itemId}) error: ${reason}`);
      const tags = await fetchAuthoritativeTags(itemId);
      if (tags) return tagsToResult(tags, reason);
      return { ok: false, message: reason ?? 'check_failed' };
    } catch (err) {
      log.warn(`[market] checkAccount(${itemId}) threw`, err);
      return { ok: false, message: err instanceof Error ? err.message : 'check_failed' };
    }
  }
  return { ok: false, message: 'retry_request' };
};

export const fetchSteamMafile = async (itemId: number): Promise<string | null> => {
  const token = await loadToken();
  if (!token) return null;
  try {
    const resp = await getClient().getSteamMafile(itemId);
    return extractSharedSecret(resp);
  } catch (err) {
    log.warn('[market] getSteamMafile failed', err);
    return null;
  }
};

const asTrimmedString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

const pickLoginRaw = (item: RawMarketItem, serviceId: ServiceId | null): string | null => {
  const ld = item.loginData;
  const fromLoginData =
    ld && typeof ld === 'object' ? asTrimmedString((ld as { login?: unknown }).login) : null;
  const fromAccountLogin = asTrimmedString(item.account_login);

  if (serviceId === 'telegram') {
    return asTrimmedString(item.telegram_phone) ?? null;
  }
  return fromLoginData ?? fromAccountLogin;
};

const pickPasswordRaw = (item: RawMarketItem, serviceId: ServiceId | null): string | null => {
  const ld = item.loginData;
  const fromLoginData =
    ld && typeof ld === 'object' ? asTrimmedString((ld as { password?: unknown }).password) : null;
  const fromAccountPassword = asTrimmedString(item.account_password);

  if (serviceId === 'telegram') {
    return asTrimmedString(item.telegram_password_value) ?? null;
  }
  return fromLoginData ?? fromAccountPassword;
};

export const getAccountDetails = async (itemId: number): Promise<AccountDetails | null> => {
  try {
    const resp = await getClient().getItem(itemId);
    const item = resp.item;
    if (!item) return null;
    // Scope is irrelevant for a single item's login flow; default to 'purchased'.
    const summary = normalizeItem(item, 'purchased');
    const loginRaw = pickLoginRaw(item, summary.category);
    const passwordRaw = pickPasswordRaw(item, summary.category);
    // Ownership uses the market's own authoritative flags, NOT credential
    // presence (which varies by category and state):
    //   - `buyer.visitorIsBuyer === true`  → we bought this account
    //   - `visitorIsAuthor === true`        → it's our own listing
    // `item.buyer` alone is NOT enough: it's set for any item sold to *someone*,
    // so a stranger's already-sold listing has `buyer` present but
    // `visitorIsBuyer === false`. Both flags being false means it isn't ours.
    const anyItem = item as unknown as Record<string, unknown>;
    const buyer = anyItem.buyer as { visitorIsBuyer?: boolean } | null | undefined;
    const owned = buyer?.visitorIsBuyer === true || anyItem.visitorIsAuthor === true;
    log.debug(
      `[market] item #${itemId} category=${summary.categoryRaw} owned=${owned} ` +
        `loginRaw=${loginRaw ? 'present' : 'missing'} ` +
        `passwordRaw=${passwordRaw ? 'present' : 'missing'}`,
    );
    return {
      ...summary,
      loginRaw,
      passwordRaw,
      secrets: item,
      owned,
    };
  } catch (err) {
    log.warn('[market] getAccountDetails failed', err);
    return null;
  }
};

// --- User labels (метки) -----------------------------------------------------

// The user's own label palette, cached in memory and reset on token change
// (alongside `client`). New labels can only be created on the web; here we just
// read the palette and attach/detach existing labels to items.
let labelsCache: UserLabel[] | null = null;

onTokenChange(() => {
  labelsCache = null;
});

const mapUserTags = (tags: RawUserTag[] | undefined): UserLabel[] => {
  const out: UserLabel[] = [];
  for (const t of tags ?? []) {
    const id = asNumber(t?.tag_id);
    const title = asString(t?.title)?.trim();
    if (id === null || !title) continue;
    out.push({
      id,
      title,
      bc: asString(t?.bc)?.trim() ?? '',
      isDefault: t?.isDefault === true,
      forOwnedAccountsOnly: t?.forOwnedAccountsOnly === true,
    });
  }
  return out;
};

const normalizeLabels = (raw: RawProfileResponse): UserLabel[] =>
  mapUserTags(raw.user.tags as RawUserTag[] | undefined);

export const listUserLabels = async (opts?: { refresh?: boolean }): Promise<UserLabel[]> => {
  if (!opts?.refresh && labelsCache) return labelsCache;
  const token = await loadToken();
  if (!token) return [];
  try {
    const raw = await getClient().me();
    if (raw?.user) {
      labelsCache = normalizeLabels(raw);
      return labelsCache;
    }
  } catch (err) {
    log.warn('[market] listUserLabels failed', err);
  }
  return labelsCache ?? [];
};

const tagOpError = (resp: { errors?: string[] | string }): string | null => {
  const e = resp.errors;
  if (Array.isArray(e) && e.length > 0 && typeof e[0] === 'string') return e[0];
  if (typeof e === 'string' && e) return e;
  return null;
};

export type LabelResult = { ok: true; labels: UserLabel[] } | { ok: false; message: string };

const refreshUserTags = async (): Promise<UserLabel[]> => {
  const resp = await getClient().getUserTags();
  if (tagOpError(resp) || !Array.isArray(resp.tags)) return labelsCache ?? [];
  labelsCache = mapUserTags(resp.tags);
  return labelsCache;
};

const runLabelMutation = async (
  op: () => Promise<{ errors?: string[] | string }>,
  what: string,
): Promise<LabelResult> => {
  const token = await loadToken();
  if (!token) return { ok: false, message: 'not_authenticated' };
  let resp: { errors?: string[] | string };
  try {
    resp = await op();
  } catch (err) {
    log.warn(`[market] ${what} failed`, err);
    return { ok: false, message: err instanceof Error ? err.message : 'label_failed' };
  }
  const err = tagOpError(resp);
  if (err) return { ok: false, message: err };
  try {
    return { ok: true, labels: await refreshUserTags() };
  } catch (refreshErr) {
    log.warn(`[market] ${what} refresh failed (mutation ok)`, refreshErr);
    return { ok: true, labels: labelsCache ?? [] };
  }
};

export const createLabel = (title: string, bc: string): Promise<LabelResult> =>
  runLabelMutation(() => getClient().createUserTag(title, bc), 'createLabel');

export const updateLabel = (tagId: number, title: string, bc: string): Promise<LabelResult> =>
  runLabelMutation(() => getClient().updateUserTag(tagId, title, bc), 'updateLabel');

export const deleteLabel = (tagId: number): Promise<LabelResult> =>
  runLabelMutation(() => getClient().deleteUserTag(tagId), 'deleteLabel');

export const reorderLabels = async (tagIds: number[]): Promise<LabelResult> => {
  const known = (labelsCache ?? (await listUserLabels())).map((l) => l.id);
  const seen = new Set(tagIds);
  const full = [...tagIds, ...known.filter((id) => !seen.has(id))];
  return runLabelMutation(() => getClient().reorderUserTags(full), 'reorderLabels');
};

export const addItemTag = async (
  itemId: number,
  tagId: number,
): Promise<{ ok: true } | { ok: false; message: string }> => {
  const token = await loadToken();
  if (!token) return { ok: false, message: 'not_authenticated' };
  try {
    const resp = await getClient().addItemTag(itemId, tagId);
    const err = tagOpError(resp);
    if (err) return { ok: false, message: err };
    return { ok: true };
  } catch (err) {
    log.warn(`[market] addItemTag(${itemId}, ${tagId}) failed`, err);
    return { ok: false, message: err instanceof Error ? err.message : 'tag_failed' };
  }
};

export const removeItemTag = async (
  itemId: number,
  tagId: number,
): Promise<{ ok: true } | { ok: false; message: string }> => {
  const token = await loadToken();
  if (!token) return { ok: false, message: 'not_authenticated' };
  try {
    const resp = await getClient().removeItemTag(itemId, tagId);
    const err = tagOpError(resp);
    if (err) return { ok: false, message: err };
    return { ok: true };
  } catch (err) {
    log.warn(`[market] removeItemTag(${itemId}, ${tagId}) failed`, err);
    return { ok: false, message: err instanceof Error ? err.message : 'tag_failed' };
  }
};

// --- Account currency --------------------------------------------------------

export const setCurrency = async (
  currency: string,
): Promise<{ ok: true } | { ok: false; message: string }> => {
  const token = await loadToken();
  if (!token) return { ok: false, message: 'not_authenticated' };
  try {
    const resp = await getClient().updateCurrency(currency);
    const err = tagOpError(resp);
    if (err) return { ok: false, message: err };
    return { ok: true };
  } catch (err) {
    log.warn(`[market] setCurrency(${currency}) failed`, err);
    return { ok: false, message: err instanceof Error ? err.message : 'currency_failed' };
  }
};

const normalizeLetter = (raw: RawLetter, idx: number): MailLetter => ({
  id: String(raw.id ?? idx),
  subject: asString(raw.subject) ?? asString(raw.title),
  from: asString(raw.from) ?? asString(raw.sender),
  to: asString(raw.to),
  date: asNumber(raw.date) ?? asNumber(raw.timestamp),
  textPlain: asString(raw.textPlain) ?? asString(raw.text) ?? asString(raw.body),
  textHtml: asString(raw.textHtml) ?? asString(raw.html),
});

const lettersError = (resp: { error?: string; errors?: string[] | string }): string | null => {
  if (typeof resp.error === 'string' && resp.error) return resp.error;
  return tagOpError(resp);
};

export const fetchLetters = async (req: MailLettersRequest): Promise<MailLettersResult> => {
  const token = await loadToken();
  if (!token) return { ok: false, message: 'not_authenticated' };
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const resp = await getClient().getLetters(req);
      const err = lettersError(resp);
      if (err === 'retry_request') {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      if (err) return { ok: false, message: err };
      const rawList = resp.letters ?? resp.items ?? [];
      return { ok: true, letters: rawList.map(normalizeLetter) };
    } catch (err) {
      log.warn('[market] fetchLetters failed', err);
      return { ok: false, message: err instanceof Error ? err.message : 'letters_failed' };
    }
  }
  return { ok: false, message: 'retry_request' };
};

export interface MarketProxy {
  protocol: 'http' | 'https';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

const asStr = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined;

const normalizeProxy = (raw: unknown): MarketProxy | null => {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const host = asStr(o.proxy_ip ?? o.ip ?? o.host ?? o.address ?? o.server);
  const portStr = asStr(o.proxy_port ?? o.port);
  const port = portStr ? Number(portStr) : Number.NaN;
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  const type = (asStr(o.proxy_type ?? o.type ?? o.protocol) ?? 'http').toLowerCase();
  return {
    protocol: type.includes('https') ? 'https' : 'http',
    host,
    port,
    username: asStr(o.proxy_user ?? o.username ?? o.user ?? o.login),
    password: asStr(o.proxy_pass ?? o.password ?? o.pass),
  };
};

const collectProxyRecords = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const key of ['proxies', 'proxy', 'items', 'data']) {
      const v = o[key];
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>);
    }
  }
  return [];
};

export const fetchMarketProxies = async (): Promise<MarketProxy[]> => {
  const token = await loadToken();
  if (!token) throw new Error('not_authenticated');
  const data = await getClient().listProxies();
  const list = collectProxyRecords(data)
    .map(normalizeProxy)
    .filter((p): p is MarketProxy => p !== null);
  log.info(`[market] fetched ${list.length} proxy(ies) from forum`);
  return list;
};
