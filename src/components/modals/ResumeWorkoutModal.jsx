import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { Z_RESUME_PROMPT } from './zIndex';

const ResumeWorkoutModal = ({ activeSession, onResume, onDiscard }) => {
  const { t } = useTranslation();
  const { session } = activeSession;
  const completed = session.exercises.reduce((n, ex) => n + ex.setsCompleted.filter(s => s !== null).length, 0);
  const total = session.exercises.reduce((n, ex) => n + ex.setsCompleted.length, 0);
  return (
    <Modal ariaLabel="Resume workout" z={Z_RESUME_PROMPT} cardClassName="max-w-sm p-6">
      <h3 className="text-lg font-semibold mb-2">{t('modals.resumeWorkout')}</h3>
      <p className="text-card leading-relaxed mb-1 text-ink/60">{t('modals.inProgress', { name: t(`workout.type${session.type}`) })}</p>
      <p className="text-body mb-8 text-ink/62">{t('modals.setsCompleted', { completed, total })}</p>
      <button onClick={onResume} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent-300 font-medium text-[14.5px] active:scale-95 mb-6">{t('modals.resume')}</button>
      <button onClick={onDiscard} className="w-full min-h-[44px] flex items-center justify-center text-card active:scale-90 text-ink/62">{t('modals.discard')}</button>
    </Modal>
  );
};

export default ResumeWorkoutModal;
