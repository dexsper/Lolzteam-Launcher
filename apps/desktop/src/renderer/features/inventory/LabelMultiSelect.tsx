import type { UserLabel } from '@shared-types';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { labelColors } from '~/lib/labelColor';
import s from './LabelMultiSelect.module.scss';

interface LabelMultiSelectProps {
  title: string;
  labels: UserLabel[];
  selected: number[];
  onToggle: (id: number) => void;
  variant: 'include' | 'exclude';
}

export const LabelMultiSelect = ({
  title,
  labels,
  selected,
  onToggle,
  variant,
}: LabelMultiSelectProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const selectedLabels = labels.filter((l) => selected.includes(l.id));

  return (
    <div className={s.group}>
      <span className={s.groupLabel}>{title}</span>
      <div className={s.root} ref={rootRef}>
        <button
          type="button"
          className={s.control}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={s.value}>
            {selectedLabels.length === 0 ? (
              <span className={s.placeholder}>{t('inventory.filters.labelAny')}</span>
            ) : (
              selectedLabels.map((label) => {
                const c = labelColors(label.bc);
                return (
                  <span
                    key={label.id}
                    className={`${s.chip} ${variant === 'exclude' ? s.chipExclude : ''}`}
                    style={
                      variant === 'include'
                        ? { backgroundColor: c.background, color: c.text }
                        : undefined
                    }
                  >
                    {label.title}
                  </span>
                );
              })
            )}
          </span>
          <ChevronDown size={15} className={`${s.chevron} ${open ? s.chevronOpen : ''}`} />
        </button>

        {open && (
          <div className={s.menu}>
            {labels.map((label) => {
              const on = selected.includes(label.id);
              const c = labelColors(label.bc);
              return (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={on}
                  className={`${s.option} ${on ? s.optionOn : ''}`}
                  onClick={() => onToggle(label.id)}
                >
                  <span className={s.dot} style={{ backgroundColor: c.background }} />
                  <span className={s.optionTitle}>{label.title}</span>
                  {on && (
                    <Check size={15} className={variant === 'exclude' ? s.checkExclude : ''} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
