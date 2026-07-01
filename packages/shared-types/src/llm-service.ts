export const LLM_SERVICES = ['claude', 'chatgpt', 'cursor', 'grok'] as const;
export type LlmServiceId = (typeof LLM_SERVICES)[number];

export const SUPPORTED_LLM_SERVICES: readonly LlmServiceId[] = [
  'claude',
  'grok',
  'cursor',
  'chatgpt',
];

export const isLlmServiceSupported = (id: LlmServiceId | null | undefined): boolean =>
  id != null && SUPPORTED_LLM_SERVICES.includes(id);

export const LLM_SERVICE_LABELS: Record<LlmServiceId, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  cursor: 'Cursor',
  grok: 'Grok',
};

export const detectLlmService = (...parts: (string | null | undefined)[]): LlmServiceId | null => {
  const hay = parts.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return null;
  if (hay.includes('claude')) return 'claude';
  if (hay.includes('cursor')) return 'cursor';
  if (hay.includes('grok')) return 'grok';
  if (hay.includes('chatgpt') || hay.includes('openai') || hay.includes('gpt')) return 'chatgpt';
  return null;
};
