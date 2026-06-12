import { type UserLabel, isEditableLabel } from '@shared-types';
import { ArrowLeft, GripVertical, Loader2, Lock, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { labelColors } from '~/lib/labelColor';
import { useProfileLabels } from '~/stores/profileLabels';
import { Modal } from '~/widgets/Modal/Modal';
import { LabelEditorModal } from './LabelEditorModal';
import s from './ProfileView.module.scss';

interface ProfileViewProps {
  onBack: () => void;
}

const isCustom = (label: UserLabel) => label.id >= 4;

export const ProfileView = ({ onBack }: ProfileViewProps) => {
  const { t } = useTranslation();
  const labels = useProfileLabels((p) => p.labels);
  const loading = useProfileLabels((p) => p.loading);
  const load = useProfileLabels((p) => p.load);
  const refresh = useProfileLabels((p) => p.refresh);
  const createLabel = useProfileLabels((p) => p.create);
  const updateLabel = useProfileLabels((p) => p.update);
  const removeLabel = useProfileLabels((p) => p.remove);
  const reorder = useProfileLabels((p) => p.reorder);

  const [editing, setEditing] = useState<UserLabel | 'new' | null>(null);
  const [deleting, setDeleting] = useState<UserLabel | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = labels.filter(isCustom);
  const editable = shown.filter(isEditableLabel);

  const persistOrder = async (orderedEditable: UserLabel[]) => {
    let ci = 0;
    const fullOrder = labels.map((l) =>
      isEditableLabel(l) ? (orderedEditable[ci++]?.id ?? l.id) : l.id,
    );
    setBusy(true);
    await reorder(fullOrder);
    setBusy(false);
  };

  const handleDrop = async (targetId: number) => {
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (from === null || from === targetId || busy) return;
    const fromIdx = editable.findIndex((l) => l.id === from);
    const toIdx = editable.findIndex((l) => l.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...editable];
    const [moved] = next.splice(fromIdx, 1);
    if (!moved) return;
    next.splice(toIdx, 0, moved);
    await persistOrder(next);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const res = await removeLabel(deleting.id);
    setDeleteBusy(false);
    if (res.ok) setDeleting(null);
    else setDeleteError(res.message ?? t('settings.profile.labelDeleteFailed'));
  };

  return (
    <div className={s.container}>
      <div className={s.block}>
        <header className={s.header}>
          <button
            type="button"
            className={s.back}
            onClick={onBack}
            aria-label={t('settings.profile.back')}
          >
            <ArrowLeft size={18} />
          </button>
          <span className={s.headerTitle}>{t('settings.profile.labelsTitle')}</span>
        </header>

        <div className={s.labelsBlock}>
          <div className={s.labelsHead}>
            <div className={s.text}>
              <span className={s.title}>{t('settings.profile.labelsTitle')}</span>
              <span className={s.description}>{t('settings.profile.labelsHint')}</span>
            </div>
            <div className={s.headActions}>
              <button
                type="button"
                className={s.refreshBtn}
                onClick={() => void refresh()}
                disabled={loading}
              >
                {loading ? <Loader2 size={14} className={s.spin} /> : <RefreshCw size={14} />}
                <span>{t('settings.profile.refresh')}</span>
              </button>
              <button type="button" className={s.createBtn} onClick={() => setEditing('new')}>
                {t('settings.profile.labelNew')}
              </button>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className={s.empty}>
              {loading ? t('settings.profile.loading') : t('settings.profile.empty')}
            </p>
          ) : (
            <ul className={s.list}>
              {shown.map((label) => {
                const c = labelColors(label.bc);
                const locked = !isEditableLabel(label);
                if (locked) {
                  return (
                    <li key={label.id} className={`${s.row} ${s.rowLocked}`}>
                      <span className={s.lockHandle} title={t('settings.profile.labelLocked')}>
                        <Lock size={14} />
                      </span>
                      <span
                        className={s.chip}
                        style={{ backgroundColor: c.background, color: c.text }}
                      >
                        {label.title}
                      </span>
                      <span className={s.lockedHint}>{t('settings.profile.labelDefault')}</span>
                    </li>
                  );
                }
                return (
                  <li
                    key={label.id}
                    className={`${s.row} ${dragId === label.id ? s.rowDragging : ''} ${
                      overId === label.id && dragId !== null && dragId !== label.id ? s.rowOver : ''
                    }`}
                    draggable={!busy}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDragId(label.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    onDragOver={(e) => {
                      if (dragId === null) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (overId !== label.id) setOverId(label.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      void handleDrop(label.id);
                    }}
                  >
                    <span className={s.dragHandle} aria-hidden>
                      <GripVertical size={15} />
                    </span>
                    <span
                      className={s.chip}
                      style={{ backgroundColor: c.background, color: c.text }}
                    >
                      {label.title}
                    </span>
                    <div className={s.rowActions}>
                      {busy && dragId === null && <Loader2 size={14} className={s.spin} />}
                      <button
                        type="button"
                        className={s.iconBtn}
                        onClick={() => setEditing(label)}
                        aria-label={t('settings.profile.labelEdit')}
                        disabled={busy}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className={`${s.iconBtn} ${s.iconBtnDanger}`}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(label);
                        }}
                        aria-label={t('settings.profile.labelDelete')}
                        disabled={busy}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <LabelEditorModal
          label={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={(title, bc) =>
            editing === 'new' ? createLabel(title, bc) : updateLabel(editing.id, title, bc)
          }
        />
      )}

      {deleting && (
        <Modal title={t('settings.profile.labelDelete')} closable onClose={() => setDeleting(null)}>
          <div className={s.confirm}>
            <p className={s.confirmBody}>
              {t('settings.profile.labelDeleteConfirm', { title: deleting.title })}
            </p>
            {deleteError && <p className={s.confirmError}>{deleteError}</p>}
            <div className={s.confirmActions}>
              <button
                type="button"
                className={s.confirmCancel}
                onClick={() => setDeleting(null)}
                disabled={deleteBusy}
              >
                {t('settings.profile.cancel')}
              </button>
              <button
                type="button"
                className={s.confirmDanger}
                onClick={() => void confirmDelete()}
                disabled={deleteBusy}
              >
                {deleteBusy && <Loader2 size={14} className={s.spin} />}
                <span>{t('settings.profile.labelDelete')}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
