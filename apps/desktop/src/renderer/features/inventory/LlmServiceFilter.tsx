import { LLM_SERVICES, LLM_SERVICE_LABELS, type LlmServiceId } from '@shared-types';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import s from './LlmServiceFilter.module.scss';

export type LlmServiceFilterValue = LlmServiceId | 'all';

interface LlmServiceFilterProps {
  value: LlmServiceFilterValue;
  onChange: (value: LlmServiceFilterValue) => void;
}

export const LlmServiceFilter = ({ value, onChange }: LlmServiceFilterProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const options: LlmServiceFilterValue[] = ['all', ...LLM_SERVICES];
  const labelOf = (v: LlmServiceFilterValue): string =>
    v === 'all' ? t('inventory.llmService.all') : LLM_SERVICE_LABELS[v];

  return (
    <div className={s.wrap} ref={ref}>
      <button
        type="button"
        className={`${s.trigger} ${value !== 'all' ? s.triggerActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{labelOf(value)}</span>
        <ChevronDown size={14} className={`${s.chevron} ${open ? s.chevronOpen : ''}`} />
      </button>
      {open && (
        <div className={s.menu} role="menu">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`${s.item} ${value === opt ? s.itemActive : ''}`}
              role="menuitemradio"
              aria-checked={value === opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              <span>{labelOf(opt)}</span>
              {value === opt && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
