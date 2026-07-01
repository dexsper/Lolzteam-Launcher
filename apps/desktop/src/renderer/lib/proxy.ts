import type { ProxyEntry } from '@shared-types';

export const proxyKey = (
  p: Pick<ProxyEntry, 'host' | 'port' | 'username' | 'password' | 'protocol'>,
): string =>
  `${p.protocol ?? 'http'}://${p.host}:${p.port}:${p.username ?? ''}:${p.password ?? ''}`;

export const parseProxyLine = (line: string): Omit<ProxyEntry, 'id'> | null => {
  let rest = line.trim();
  if (!rest) return null;

  let protocol: 'http' | 'https' = 'http';
  const lower = rest.toLowerCase();
  if (lower.startsWith('https://')) {
    protocol = 'https';
    rest = rest.slice(8);
  } else if (lower.startsWith('http://')) {
    rest = rest.slice(7);
  } else if (lower.startsWith('socks5://')) {
    rest = rest.slice(9);
  } else if (lower.startsWith('socks://')) {
    rest = rest.slice(8);
  }

  const parts = rest.split(':');
  if (parts.length < 2) return null;
  const [host, portRaw, username, ...pwParts] = parts;
  const password = pwParts.length > 0 ? pwParts.join(':') : undefined;
  const port = Number(portRaw);
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return {
    protocol,
    host,
    port,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  };
};
