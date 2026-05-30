const STEAM64_BASE = 76561197960265728n;

export const steam64ToSteam32 = (steamId64: string): string => {
  const big = BigInt(steamId64);
  return (big - STEAM64_BASE).toString();
};
