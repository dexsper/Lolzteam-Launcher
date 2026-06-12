import type { LauncherSettings, ProxyEntry } from '@shared-types';
import { Globe, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '~/stores/settings';
import { Tooltip } from '~/widgets/Tooltip/Tooltip';
import s from './ProxyPingPill.module.scss';

type PingState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; ms: number }
  | { kind: 'fail' };

const activeProxy = (settings: LauncherSettings | null): ProxyEntry | null => {
  if (!settings?.appProxyId) return null;
  return settings.proxies.find((p) => p.id === settings.appProxyId) ?? null;
};

export const ProxyPingPill = () => {
  const { t } = useTranslation();
  const settings = useSettings((st) => st.settings);
  const proxy = activeProxy(settings);
  const [state, setState] = useState<PingState>({ kind: 'idle' });
  const reqRef = useRef(0);

  const check = useCallback(async () => {
    const ticket = ++reqRef.current;
    setState({ kind: 'checking' });
    const current = activeProxy(useSettings.getState().settings);
    try {
      if (current) {
        const res = await window.launcher.proxy.test({
          host: current.host,
          port: current.port,
          username: current.username,
          password: current.password,
        });
        if (ticket !== reqRef.current) return;
        setState(res.ok ? { kind: 'ok', ms: res.ms } : { kind: 'fail' });
      } else {
        const res = await window.launcher.app.pingApi();
        if (ticket !== reqRef.current) return;
        setState(res.online ? { kind: 'ok', ms: res.ms } : { kind: 'fail' });
      }
    } catch {
      if (ticket === reqRef.current) setState({ kind: 'fail' });
    }
  }, []);

  const sig = proxy ? `${proxy.host}:${proxy.port}:${proxy.username ?? ''}` : 'direct';
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on proxy change via sig
  useEffect(() => {
    void check();
  }, [sig, check]);

  const label = proxy ? proxy.host : t('topbar.proxyDirect');

  let value: string;
  if (state.kind === 'ok') value = t('settings.proxy.ping', { ms: state.ms });
  else if (state.kind === 'fail') value = t('topbar.pingFail');
  else value = '…';

  const dotClass =
    state.kind === 'ok' ? s.dotOk : state.kind === 'fail' ? s.dotFail : s.dotChecking;

  return (
    <Tooltip label={t('topbar.proxyRefresh')} placement="bottom">
      <button
        type="button"
        className={s.pill}
        onClick={() => void check()}
        disabled={state.kind === 'checking'}
      >
        {state.kind === 'checking' ? (
          <Loader2 size={12} className={s.spin} />
        ) : (
          <Globe size={12} className={s.icon} />
        )}
        <span className={s.label}>{label}</span>
        <span className={`${s.dot} ${dotClass}`} />
        <span className={s.value}>{value}</span>
      </button>
    </Tooltip>
  );
};
