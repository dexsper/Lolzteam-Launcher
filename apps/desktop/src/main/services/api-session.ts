import type { ProxyEntry } from '@shared-types';
import { net, type Session, session } from 'electron';
import log from 'electron-log/main';
import { getSettings, onSettingsChange } from '../settings/settings-store';
import { applyProxyToSession, clearProxyFromSession, proxyLoginFor, syncProxyCreds } from './proxy';

export const APP_PARTITION = 'persist:lolz-auth';

export const getAppSession = (): Session => session.fromPartition(APP_PARTITION);

const SKIP_REQUEST_HEADERS = new Set(['host', 'content-length', 'connection']);

export const appFetch = (async (
  input: Parameters<typeof globalThis.fetch>[0],
  init?: RequestInit,
): Promise<Response> => {
  await whenAppProxyReady();

  const request = input instanceof Request && !init ? input : new Request(input as never, init);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const bodyBuf = hasBody ? Buffer.from(await request.clone().arrayBuffer()) : undefined;

  return await new Promise<Response>((resolve, reject) => {
    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const req = net.request({
      method: request.method,
      url: request.url,
      session: getAppSession(),
      useSessionCookies: false,
    });

    request.headers.forEach((value, key) => {
      if (!SKIP_REQUEST_HEADERS.has(key.toLowerCase())) req.setHeader(key, value);
    });

    req.on('login', (authInfo, cb) => {
      const creds = authInfo.isProxy ? proxyLoginFor(authInfo.host, authInfo.port) : null;
      if (creds) cb(creds.username, creds.password);
      else cb();
    });

    req.on('response', (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (settled) return;
        settled = true;
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (v == null) continue;
          headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
        }
        resolve(
          new Response(chunks.length ? Buffer.concat(chunks) : null, {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers,
          }),
        );
      });
      res.on('error', (err: Error) => fail(err));
    });

    req.on('error', (err: Error) => fail(err));

    const signal = request.signal;
    if (signal) {
      if (signal.aborted) {
        req.abort();
        fail(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          req.abort();
          fail(new DOMException('The operation was aborted.', 'AbortError'));
        },
        { once: true },
      );
    }

    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}) as typeof globalThis.fetch;

const proxySignature = (proxy: ProxyEntry | undefined): string =>
  proxy ? `${proxy.host}:${proxy.port}:${proxy.username ?? ''}:${proxy.password ?? ''}` : '';

let applied: string | null = null;

const applyAppProxy = async (proxies: ProxyEntry[], appProxyId: string | null): Promise<void> => {
  const proxy = appProxyId ? proxies.find((p) => p.id === appProxyId) : undefined;
  const sig = proxySignature(proxy);
  if (sig === applied) return;
  applied = sig;
  const ses = getAppSession();
  try {
    if (proxy) {
      await applyProxyToSession(ses, proxy);
      log.info(`[app-proxy] routing app traffic via ${proxy.host}:${proxy.port}`);
    } else {
      await clearProxyFromSession(ses);
      log.info('[app-proxy] app traffic direct (no proxy)');
    }
  } catch (err) {
    applied = null;
    log.warn('[app-proxy] failed to apply', err);
  }
};

let applyChain: Promise<void> = Promise.resolve();

export const whenAppProxyReady = (): Promise<void> => applyChain;

export const initAppProxy = async (): Promise<void> => {
  const s = await getSettings();
  syncProxyCreds(s.proxies);
  applyChain = applyAppProxy(s.proxies, s.appProxyId);
  await applyChain;
  onSettingsChange((next) => {
    syncProxyCreds(next.proxies);
    applyChain = applyChain.then(() => applyAppProxy(next.proxies, next.appProxyId));
  });
};
