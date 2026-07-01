import { type LlmServiceId, detectLlmService } from '@shared-types';
import type { AccountDetails } from '@shared-types';

export type LlmProvider = LlmServiceId;
export type LlmLoginKind = 'session-cookie' | 'browser-cookie' | 'email-fill';

export interface LlmProviderConfig {
  provider: LlmProvider;
  displayName: string;
  loginKind: LlmLoginKind;
  /** session-cookie only: cookie domain (leading dot = all subdomains) + name. */
  cookieDomain?: string;
  cookieName?: string;
  /** session-cookie / email-fill: where the window lands. */
  landingUrl?: string;
}

const PROVIDERS: Record<LlmProvider, LlmProviderConfig> = {
  claude: {
    provider: 'claude',
    displayName: 'Claude',
    loginKind: 'session-cookie',
    cookieDomain: '.claude.ai',
    cookieName: 'sessionKey',
    landingUrl: 'https://claude.ai/login',
  },
  grok: {
    provider: 'grok',
    displayName: 'Grok',
    loginKind: 'browser-cookie',
    landingUrl: 'https://accounts.x.ai/sign-in/',
  },
  cursor: {
    provider: 'cursor',
    displayName: 'Cursor',
    loginKind: 'browser-cookie',
    landingUrl: 'https://cursor.com/',
  },
  chatgpt: {
    provider: 'chatgpt',
    displayName: 'ChatGPT',
    loginKind: 'email-fill',
    landingUrl: 'https://chatgpt.com/',
  },
};

export const resolveLlmProvider = (details: AccountDetails): LlmProviderConfig | null => {
  const id =
    details.llmService ??
    detectLlmService(details.title, details.categoryTitle, details.description);
  return id ? PROVIDERS[id] : null;
};
