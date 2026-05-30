import type { ServiceAdapter } from '@adapter-contract';
import type { ServiceId } from '@shared-types';
import { steamAdapter } from './steam/adapter';
import { telegramAdapter } from './telegram/adapter';
import { instagramAdapter, tiktokAdapter } from './browser/adapter';

const REGISTRY: Partial<Record<ServiceId, ServiceAdapter>> = {
  steam: steamAdapter,
  telegram: telegramAdapter,
  tiktok: tiktokAdapter,
  instagram: instagramAdapter,
};

export const getAdapter = (id: ServiceId | null): ServiceAdapter | null =>
  id ? REGISTRY[id] ?? null : null;

export const listAdapters = (): readonly ServiceAdapter[] =>
  Object.values(REGISTRY).filter(Boolean) as ServiceAdapter[];
