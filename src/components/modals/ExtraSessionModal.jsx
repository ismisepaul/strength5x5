import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { Z_TOP } from './zIndex';

// The "Start anyway" gate. Nothing here blocks the session -- the lifter has already
// decided -- it just states the case for not taking it before they commit, and which
// case that is depends on why the session is extra: a rest day between sessions, or a
// week whose three sessions are already banked.
const ExtraSessionModal = ({ reason, onCancel, onStartAnyway }) => {
  const { t } = useTranslation();
  return (
    <Modal ariaLabel={t('modals.extraSessionTitle')} z={Z_TOP} cardClassName="max-w-xs flex flex-col items-center p-6">
      <h3 className="font-display font-semibold tracking-[-0.025em] text-lg mb-3">{t('modals.extraSessionTitle')}</h3>
      <p className="text-card leading-relaxed mb-6 text-ink/60">
        {reason === 'complete' ? t('modals.extraSessionCompleteBody') : t('modals.extraSessionRestBody')}
      </p>
      <button onClick={onCancel} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent-300 font-medium text-[14.5px] active:scale-95 mb-6">{t('modals.extraSessionRest')}</button>
      <button onClick={onStartAnyway} className="w-full min-h-[44px] flex items-center justify-center text-card active:scale-90 text-ink/62">{t('workout.startAnyway')}</button>
    </Modal>
  );
};

export default ExtraSessionModal;
