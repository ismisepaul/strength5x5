import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { Z_TOP } from './zIndex';

const DiscardWorkoutModal = ({ onKeepLifting, onDiscard }) => {
  const { t } = useTranslation();
  return (
    <Modal ariaLabel="Discard workout" z={Z_TOP} cardClassName="max-w-xs flex flex-col items-center p-6">
      <h3 className="font-display font-semibold tracking-[-0.025em] text-lg mb-3">{t('modals.discardTitle')}</h3>
      <p className="text-card leading-relaxed mb-6 text-ink/60">{t('modals.discardBody')}</p>
      <button onClick={onKeepLifting} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent-300 font-medium text-[14.5px] active:scale-95 mb-6">{t('modals.keepLifting')}</button>
      <button onClick={onDiscard} className="w-full min-h-[44px] flex items-center justify-center text-card active:scale-90 text-ink/62">{t('modals.yesDiscard')}</button>
    </Modal>
  );
};

export default DiscardWorkoutModal;
