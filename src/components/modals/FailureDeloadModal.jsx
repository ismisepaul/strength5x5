import React from 'react';
import { useTranslation } from 'react-i18next';
import { deloadWeightByPercent } from '../../utils';
import Modal from './Modal';
import { Z_TOP } from './zIndex';

const FailureDeloadModal = ({ pendingFailureDeloads, deloadPercent, onDeloadPercentChange, onConfirm, onSkip }) => {
  const { t } = useTranslation();
  const previewDeloads = pendingFailureDeloads.map(d => ({
    ...d,
    newWeight: deloadWeightByPercent(d.currentWeight, deloadPercent, d.id),
  }));
  return (
    <Modal ariaLabel="Failure deload" z={Z_TOP} cardClassName="max-w-sm p-6">
      <h3 className="text-lg font-semibold mb-3">{t('modals.failureDeloadTitle')}</h3>
      <p className="text-card leading-relaxed mb-6 text-ink/60">{t('modals.failureDeloadMessage')}</p>
      <div className="mb-4">
        <p className="text-title font-semibold mb-1">{t('modals.deloadPercent', { percent: deloadPercent })}</p>
        <p className="text-meta text-ink/45">{t('modals.deloadRecommended', { percent: 10 })}</p>
      </div>
      <input type="range" min={10} max={90} step={5} value={deloadPercent} onChange={e => onDeloadPercentChange(Number(e.target.value))} className="w-full mb-6 accent-accent" />
      <div className="space-y-2 mb-6">
        {previewDeloads.map(d => (
          <div key={d.id} className="flex justify-between items-center px-4 py-3 rounded-lg bg-surface-deep">
            <span className="text-meta uppercase text-ink/45">{t('exercises.' + d.id)}</span>
            <span className="text-card tabular-nums">{d.currentWeight}kg <span className="text-accent mx-1">&rarr;</span> {d.newWeight}kg</span>
          </div>
        ))}
      </div>
      <button onClick={() => onConfirm(previewDeloads)} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 mb-6">{t('modals.confirmDeload')}</button>
      <button onClick={onSkip} className="w-full min-h-[44px] flex items-center justify-center text-card active:scale-90 text-ink/45">{t('modals.skipDeload')}</button>
    </Modal>
  );
};

export default FailureDeloadModal;
