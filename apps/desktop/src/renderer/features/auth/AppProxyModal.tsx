import type { LauncherSettings, ProxyEntry, ProxyTestResult } from '@shared-types';
import { Check, Loader2, Plus, Wifi } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseProxyLine, proxyKey } from '~/lib/proxy';
import { Modal } from '~/widgets/Modal/Modal';
import s from './AppProxyModal.module.scss';

interface AppProxyModalProps {
  onClose: () => void;
  onChanged?: () => void;
}

export const AppProxyModal = ({ onClose, onChanged }: AppProxyModalProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [bulk, setBulk] = useState('');
  const [addError, setAddError] = useState(false);
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const proxiesRef = useRef<ProxyEntry[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let alive = true;
    window.launcher.settings.get().then((next) => {
      if (alive) setSettings(next.settings);
    });
    const off = window.launcher.settings.onChanged((next) => setSettings(next.settings));
    return () => {
      mountedRef.current = false;
      alive = false;
      off();
    };
  }, []);

  const proxies = settings?.proxies ?? [];
  const appProxyId = settings?.appProxyId ?? null;
  proxiesRef.current = proxies;

  const persist = async (patch: Partial<LauncherSettings>) => {
    const next = await window.launcher.settings.set(patch);
    setSettings(next.settings);
  };

  const select = async (id: string | null) => {
    await persist({ appProxyId: id });
    onChanged?.();
  };

  const addProxy = async () => {
    const parsed = parseProxyLine(bulk);
    if (!parsed) {
      setAddError(true);
      return;
    }
    setAddError(false);
    const key = proxyKey(parsed);
    const existing = proxiesRef.current.find((p) => proxyKey(p) === key);
    const id = existing?.id ?? crypto.randomUUID();
    const nextProxies = existing ? proxiesRef.current : [...proxiesRef.current, { ...parsed, id }];
    proxiesRef.current = nextProxies;
    await persist({ proxies: nextProxies, appProxyId: id });
    setBulk('');
    onChanged?.();
    void testProxy({ ...parsed, id });
  };

  const testProxy = async (entry: ProxyEntry) => {
    setTesting((prev) => new Set(prev).add(entry.id));
    try {
      const res = await window.launcher.proxy.test({
        host: entry.host,
        port: entry.port,
        username: entry.username,
        password: entry.password,
      });
      const test: ProxyTestResult = res.ok
        ? { ok: true, checkedAt: Date.now(), ms: res.ms, ip: res.ip }
        : { ok: false, checkedAt: Date.now(), message: res.message };
      if (!mountedRef.current) return;
      const current = proxiesRef.current;
      if (!current.some((p) => p.id === entry.id)) return;
      const next = current.map((p) => (p.id === entry.id ? { ...p, test } : p));
      proxiesRef.current = next;
      await persist({ proxies: next });
    } finally {
      setTesting((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  return (
    <Modal title={t('settings.proxy.appLabel')} closable onClose={onClose}>
      <div className={s.body}>
        <p className={s.hint}>{t('settings.proxy.appHint')}</p>

        <div className={s.addRow}>
          <input
            className={s.input}
            value={bulk}
            onChange={(e) => {
              setBulk(e.target.value);
              setAddError(false);
            }}
            placeholder={t('settings.proxy.bulkPlaceholder')}
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addProxy();
              }
            }}
          />
          <button
            type="button"
            className={s.addBtn}
            onClick={() => void addProxy()}
            disabled={bulk.trim() === ''}
          >
            <Plus size={16} />
          </button>
        </div>
        {addError && <p className={s.error}>{t('settings.proxy.addInvalid')}</p>}

        <div className={s.list}>
          <div className={`${s.option} ${appProxyId === null ? s.optionOn : ''}`}>
            <button type="button" className={s.optionSelect} onClick={() => void select(null)}>
              <span className={s.optionMain}>{t('settings.proxy.appNone')}</span>
            </button>
            {appProxyId === null && <Check size={16} className={s.optionCheck} />}
          </div>

          {proxies.map((p) => {
            const on = appProxyId === p.id;
            const isTesting = testing.has(p.id);
            const res = p.test;
            return (
              <div key={p.id} className={`${s.option} ${on ? s.optionOn : ''}`}>
                <button type="button" className={s.optionSelect} onClick={() => void select(p.id)}>
                  <span className={s.optionMain}>
                    {p.host}:{p.port}
                    {p.username ? ` · ${p.username}` : ''}
                  </span>
                  {res && (
                    <span className={res.ok ? s.statusOk : s.statusFail}>
                      {res.ok
                        ? t('settings.proxy.ping', { ms: res.ms })
                        : t('settings.proxy.statusInvalid')}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={s.testBtn}
                  onClick={() => void testProxy(p)}
                  disabled={isTesting}
                  aria-label={t('settings.proxy.testLabel')}
                >
                  {isTesting ? <Loader2 size={15} className={s.spin} /> : <Wifi size={15} />}
                </button>
                {on && <Check size={16} className={s.optionCheck} />}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
