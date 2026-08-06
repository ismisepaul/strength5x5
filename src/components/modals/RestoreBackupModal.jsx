import React from 'react';
import { useTranslation } from 'react-i18next';
import { UploadSimple, Cloud, FileCsv } from '@phosphor-icons/react';
import Modal from './Modal';
import { Z_RESTORE_PROMPT } from './zIndex';

const RestoreBackupModal = ({ driveConfigured, onRestoreFile, onConnectDrive, onImportCSV, onSkip }) => {
  const { t } = useTranslation();
  return (
    <Modal ariaLabel="Restore backup" z={Z_RESTORE_PROMPT} cardClassName="max-w-sm p-6">
      <h3 className="text-lg font-semibold mb-2">{t('modals.syncHistory')}</h3>
      <p className="text-card leading-relaxed mb-8 text-ink/60">{t('modals.syncHistoryBody')}</p>
      <div className="space-y-3">
        <button onClick={onRestoreFile} className="w-full h-12 rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 flex items-center justify-center gap-2"><UploadSimple size={18} /> {t('modals.restoreBackup')}</button>
        {driveConfigured && (
          <button onClick={onConnectDrive} className="w-full h-[46px] rounded-lg font-medium text-[14px] active:scale-95 border flex items-center justify-center gap-2 border-ink/18 text-ink"><Cloud size={18} /> {t('modals.restoreFromDrive')}</button>
        )}
        <button onClick={onImportCSV} className="w-full h-[46px] rounded-lg font-medium text-[14px] active:scale-95 border flex items-center justify-center gap-2 border-ink/18 text-ink"><FileCsv size={18} /> {t('options.importStronglifts')}</button>
        <button onClick={onSkip} className="text-card mt-4 block mx-auto text-ink/62">{t('modals.skipAndStart')}</button>
      </div>
    </Modal>
  );
};

export default RestoreBackupModal;
