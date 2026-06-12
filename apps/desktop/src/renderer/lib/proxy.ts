import type { ProxyEntry } from '@shared-types';

export const proxyKey = (p: Pick<ProxyEntry, 'host' | 'port' | 'username' | 'password'>): string =>
  `${p.host}:${p.port}:${p.username ?? ''}:${p.password ?? ''}`;

export const parseProxyLine = (line: string): Omit<ProxyEntry, 'id'> | null => {
  const parts = line.trim().split(':');
  if (parts.length < 2) return null;
  const [host, portRaw, username, ...rest] = parts;
  const password = rest.length > 0 ? rest.join(':') : undefined;
  const port = Number(portRaw);
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return {
    host,
    port,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  };
};
