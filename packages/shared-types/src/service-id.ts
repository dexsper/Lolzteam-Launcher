export const SERVICE_IDS = [
  'steam',
  'telegram',
  'discord',
  'fortnite',
  'mihoyo',
  'riot',
  'supercell',
  'ea',
  'wot',
  'wotblitz',
  'gifts',
  'epicgames',
  'eft',
  'socialclub',
  'uplay',
  'tiktok',
  'instagram',
  'battlenet',
  'llm',
  'vpn',
  'roblox',
  'warface',
  'minecraft',
  'hytale',
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

export const isServiceId = (v: unknown): v is ServiceId =>
  typeof v === 'string' && (SERVICE_IDS as readonly string[]).includes(v);
