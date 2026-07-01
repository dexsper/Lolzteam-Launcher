import { AppWindow, Check, Globe } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoginMethod } from '~/stores/loginSession';
import { Modal } from '~/widgets/Modal/Modal';
import s from './LoginMethodModal.module.scss';

interface LoginMethodModalProps {
  methods: LoginMethod[];
  onChoose: (method: LoginMethod, remember: boolean) => void;
  onCancel: () => void;
}

export const LoginMethodModal = ({ methods, onChoose, onCancel }: LoginMethodModalProps) => {
  const { t } = useTranslation();
  const [remember, setRemember] = useState(false);

  return (
    <Modal title={t('inventory.card.loginMethod.title')} closable onClose={onCancel}>
      <div className={s.list}>
        {methods.map((m) => (
          <button key={m} type="button" className={s.option} onClick={() => onChoose(m, remember)}>
            {m === 'web' ? <Globe size={18} /> : <AppWindow size={18} />}
            <span>{t(`inventory.card.loginMethod.${m}`)}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={remember}
        className={s.remember}
        onClick={() => setRemember((v) => !v)}
      >
        <span className={`${s.checkbox} ${remember ? s.checkboxOn : ''}`}>
          {remember && <Check size={12} />}
        </span>
        <span>{t('inventory.card.loginMethod.remember')}</span>
      </button>
    </Modal>
  );
};
