import type { UserLabel } from '@shared-types';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { labelColors } from '~/lib/labelColor';
import { Modal } from '~/widgets/Modal/Modal';
import s from './LabelEditorModal.module.scss';

const PRESET_COLORS = [
  '#3083ff',
  '#00ba78',
  '#e0a106',
  '#e0533f',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#64748b',
];

const MAX_TITLE = 16;
const DEFAULT_COLOR = '#3083ff';

interface LabelEditorModalProps {
  label: UserLabel | null;
  onClose: () => void;
  onSubmit: (title: string, bc: string) => Promise<{ ok: boolean; message?: string }>;
}

export const LabelEditorModal = ({ label, onClose, onSubmit }: LabelEditorModalProps) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(label?.title ?? '');
  const [color, setColor] = useState(() => {
    const c = labelColors(label?.bc);
    return c.background.startsWith('#') ? c.background : DEFAULT_COLOR;
  });
  const [colorTouched, setColorTouched] = useState(false);
  const pickColor = (c: string) => {
    setColor(c);
    setColorTouched(true);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = title.trim();
  const valid = trimmed.length > 0;
  const submitColor = !colorTouched && label?.bc ? label.bc : color;
  const preview = labelColors(submitColor);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const res = await onSubmit(trimmed.slice(0, MAX_TITLE), submitColor);
    if (res.ok) {
      onClose();
    } else {
      setError(res.message ?? t('settings.profile.labelSaveFailed'));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={label ? t('settings.profile.labelEdit') : t('settings.profile.labelNew')}
      closable
      onClose={onClose}
    >
      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className={s.previewRow}>
          <span
            className={s.preview}
            style={{ backgroundColor: preview.background, color: preview.text }}
          >
            {trimmed || t('settings.profile.labelTitlePlaceholder')}
          </span>
        </div>

        <label className={s.field}>
          <span className={s.fieldLabel}>{t('settings.profile.labelTitle')}</span>
          <input
            className={s.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_TITLE}
            placeholder={t('settings.profile.labelTitlePlaceholder')}
            spellCheck={false}
            autoFocus
          />
          <span className={s.counter}>
            {trimmed.length}/{MAX_TITLE}
          </span>
        </label>

        <div className={s.field}>
          <span className={s.fieldLabel}>{t('settings.profile.labelColor')}</span>
          <div className={s.colorRow}>
            <input
              type="color"
              className={s.colorInput}
              value={color}
              onChange={(e) => pickColor(e.target.value)}
              aria-label={t('settings.profile.labelColor')}
            />
            <div className={s.swatches}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${s.swatch} ${color.toLowerCase() === c ? s.swatchOn : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => pickColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>

        {error && <p className={s.error}>{error}</p>}

        <div className={s.actions}>
          <button type="button" className={s.cancel} onClick={onClose} disabled={busy}>
            {t('settings.profile.cancel')}
          </button>
          <button type="submit" className={s.save} disabled={!valid || busy}>
            {busy && <Loader2 size={14} className={s.spin} />}
            <span>{t('settings.profile.save')}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
