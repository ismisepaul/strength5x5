import React from 'react';
import { useTranslation } from 'react-i18next';
import { EXPECTED_WEIGHT_KEYS } from '../../constants';
import Modal from './Modal';
import { Z_CSV_IMPORT } from './zIndex';

const CSVImportModal = ({ pendingCSVImport, onImport, onCancel }) => {
  const { t } = useTranslation();
  return (
    <Modal ariaLabel="Confirm StrongLifts import" z={Z_CSV_IMPORT} cardClassName="max-w-sm p-6">
      <h3 className="text-lg font-semibold mb-2">{t('modals.importData')}</h3>
      <p className="text-card leading-relaxed mb-6 text-ink/60">{t('modals.foundWorkouts', { count: pendingCSVImport.history.length })}</p>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {EXPECTED_WEIGHT_KEYS.map(id => (
          <div key={id} className="p-3 rounded-lg text-left bg-surface-deep">
            <p className="text-meta uppercase leading-none mb-1 text-ink/62">{t('exercises.' + id)}</p>
            <p className="text-card tabular-nums">{pendingCSVImport.weights[id]}kg</p>
          </div>
        ))}
      </div>
      <button onClick={onImport} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent-300 font-medium text-[14.5px] active:scale-95 mb-3">{t('modals.import')}</button>
      <button onClick={onCancel} className="text-card active:scale-90 text-ink/62">{t('modals.cancel')}</button>
    </Modal>
  );
};

export default CSVImportModal;
