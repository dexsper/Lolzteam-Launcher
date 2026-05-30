export const LOLZ_CONFIG = {
  appName: 'Lolzteam Launcher',
  appId: 'com.lolzteam.launcher',
  protocolScheme: 'lolzteamlauncher',
  webUrl: 'https://lolz.live',
  marketWebUrl: 'https://lzt.market',
  marketApiUrl: 'https://prod-api.lzt.market',
  // Forum API — the only `/users/me` that returns avatar URLs (market `/me`
  // exposes just an `avatar_date` integer, no usable image link).
  forumApiUrl: 'https://prod-api.lolz.live',

  clientId: 'tyulsodtmt',
  authRedirectUri: 'lolzteamlauncher://oauth/callback',
  // `basic` grants read access to the user's profile (username, avatar) via /me;
  // `market` covers the purchased-accounts endpoints.
  oauthScopes: 'basic market',
} as const;

export type LolzConfig = typeof LOLZ_CONFIG;
