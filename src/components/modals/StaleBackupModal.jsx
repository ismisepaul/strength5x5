import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { Z_TOP } from './zIndex';

// Shared by both stale-backup warnings -- a Google Drive restore and a local-file
// import that would lose local history -- since the copy and layout are identical;
// only the data and the restore action differ per caller.
const StaleBackupModal = ({ backupCount, backupDate, localCount, lossCount, onRestoreAnyway, onCancel }) => {
  const { t } = useTranslation();
  return (
    <Modal ariaLabel="Older backup warning" z={Z_TOP} cardClassName="max-w-sm p-6">
      <h3 className="text-lg font-semibold mb-3">{t('modals.olderBackupTitle')}</h3>
      <p className="text-card leading-relaxed mb-6 text-ink/60">{t('modals.olderBackupBody', { backupCount, backupDate, localCount, lossCount })}</p>
      <button onClick={onRestoreAnyway} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 mb-3">{t('modals.restoreAnyway')}</button>
      <button onClick={onCancel} className="text-card active:scale-90 text-ink/62">{t('modals.cancel')}</button>
    </Modal>
  );
};

export default StaleBackupModal;
