import React from 'react';
import { useTranslation } from 'react-i18next';
import { getProgram } from '../../programs';
import Sheet from './Sheet';
import { Z_EDIT_ENTRY } from './zIndex';

// Deleting a session is a deliberate two-step: "Keep session" is the prominent,
// bordered action; "Delete anyway" is plain text underneath it, reachable but never
// by accident. The caller applies the deletion optimistically and offers Undo via a
// toast -- this sheet only asks the question.
const DeleteEntryConfirmSheet = ({ session, onKeep, onDelete }) => {
  const { t } = useTranslation();
  return (
    <Sheet ariaLabel={t('modals.deleteWorkout')} z={Z_EDIT_ENTRY} onClose={onKeep}>
      <h3 className="font-display font-semibold tracking-[-0.025em] text-lg text-center mb-2">{t('modals.deleteWorkout')}</h3>
      <p className="text-body text-center mb-6 text-ink/62">
        {t('modals.deleteConfirmNamed', { workout: t(`workout.type${session.type}`), program: t(getProgram(session.preset).nameKey) })}
      </p>
      <button
        onClick={onKeep}
        className="w-full h-[52px] flex items-center justify-center rounded-lg border border-accent text-accent font-medium active:scale-95 mb-4"
      >{t('modals.keepSession')}</button>
      <button
        onClick={onDelete}
        className="w-full text-center text-body text-ink/50 active:scale-95"
      >{t('modals.deleteAnyway')}</button>
    </Sheet>
  );
};

export default DeleteEntryConfirmSheet;
