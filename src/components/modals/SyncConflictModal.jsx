import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { Z_TOP } from './zIndex';

const SyncConflictModal = ({ connectSyncPrompt, onUseDriveData, onUseLocalData, onCancel }) => {
  const { t } = useTranslation();
  return (
    <Modal ariaLabel="Data conflict" z={Z_TOP} cardClassName="max-w-sm p-6">
      <h3 className="text-lg font-semibold mb-3">{t('modals.dataConflictTitle')}</h3>
      <p className="text-card leading-relaxed mb-6 text-ink/60">
        {t('modals.dataConflictBody', {
          driveCount: connectSyncPrompt.driveCount,
          cloudDate: connectSyncPrompt.cloudDate,
          localCount: connectSyncPrompt.localCount,
          localDate: connectSyncPrompt.localDate,
        })}
      </p>
      <div className="space-y-3 mb-4">
        <button
          onClick={onUseDriveData}
          disabled={!connectSyncPrompt.driveData}
          className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 disabled:opacity-35"
        >
          {t('modals.useDriveData')}
        </button>
        <button
          onClick={onUseLocalData}
          className="w-full h-[46px] flex items-center justify-center rounded-lg font-medium text-[14px] active:scale-95 border border-ink/18 text-ink"
        >
          {t('modals.useLocalData')}
        </button>
      </div>
      <button onClick={onCancel} className="text-card active:scale-90 text-ink/62">{t('modals.cancel')}</button>
    </Modal>
  );
};

export default SyncConflictModal;
