import type { ServiceId } from './service-id';

/**
 * Map lzt.market `category.name` (slug from API) onto our internal ServiceId.
 * Categories not listed here are returned as null — the renderer will show
 * them in an "Other" bucket and gray out the login button.
 */
const NAME_TO_SERVICE: Record<string, ServiceId> = {
  steam: 'steam',
  telegram: 'telegram',
  discord: 'discord',
  fortnite: 'fortnite',
  mihoyo: 'mihoyo',
  riot: 'riot',
  supercell: 'supercell',
  ea: 'ea',
  origin: 'ea',
  wot: 'wot',
  'wot-blitz': 'wotblitz',
  wotblitz: 'wotblitz',
  gifts: 'gifts',
  'epicgames': 'epicgames',
  'epic-games': 'epicgames',
  eft: 'eft',
  'escape-from-tarkov': 'eft',
  socialclub: 'socialclub',
  'social-club': 'socialclub',
  uplay: 'uplay',
  tiktok: 'tiktok',
  instagram: 'instagram',
  battlenet: 'battlenet',
  'battle-net': 'battlenet',
  llm: 'llm',
  vpn: 'vpn',
  roblox: 'roblox',
  warface: 'warface',
  minecraft: 'minecraft',
  hytale: 'hytale',
};

export const categoryNameToServiceId = (name: string | undefined | null): ServiceId | null => {
  if (!name) return null;
  return NAME_TO_SERVICE[name.toLowerCase()] ?? null;
};
