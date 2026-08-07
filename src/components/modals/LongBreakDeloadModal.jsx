import React from 'react';
import { useTranslation } from 'react-i18next';
import { calculateDeload } from '../../utils';
import { EXPECTED_WEIGHT_KEYS } from '../../constants';
import Modal from './Modal';
import { Z_DELOAD_ALERT } from './zIndex';

const LongBreakDeloadModal = ({ deloadAlert, deloadPercent, onDeloadPercentChange, weights, onAccept, onSkip }) => {
  const { t } = useTranslation();
  const previewWeights = calculateDeload(weights, deloadPercent);
  return (
    <Modal ariaLabel="Deload recommendation" z={Z_DELOAD_ALERT} cardClassName="max-w-sm p-6">
      <h3 className="font-display font-semibold tracking-[-0.025em] text-lg mb-3">{t('modals.acceptDeload')}</h3>
      <p className="text-card leading-relaxed mb-6 text-ink/60">{deloadAlert.message}</p>
      <div className="mb-4">
        <p className="font-display text-title font-semibold tabular-nums mb-1">{t('modals.deloadPercent', { percent: deloadPercent })}</p>
        <p className="text-meta text-ink/62">{t('modals.deloadRecommended', { percent: deloadAlert.recommended })}</p>
      </div>
      <input type="range" min={10} max={90} step={5} value={deloadPercent} onChange={e => onDeloadPercentChange(Number(e.target.value))} className="w-full mb-6 accent-accent" />
      <div className="space-y-2 mb-6">
        {EXPECTED_WEIGHT_KEYS.filter(id => weights[id] > 0).map(id => (
          <div key={id} className="flex justify-between items-center px-4 py-3 rounded-lg bg-surface-deep">
            <span className="text-meta uppercase text-ink/62">{t('exercises.' + id)}</span>
            <span className="font-display font-semibold text-card tabular-nums">{weights[id]}kg <span className="text-accent mx-1">&rarr;</span> {previewWeights[id]}kg</span>
          </div>
        ))}
      </div>
      <button onClick={() => onAccept(previewWeights)} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent-300 font-medium text-[14.5px] active:scale-95 mb-6">{t('modals.acceptAndLift')}</button>
      <button onClick={onSkip} className="w-full min-h-[44px] flex items-center justify-center text-card active:scale-90 text-ink/62">{t('modals.skipDeload')}</button>
    </Modal>
  );
};

export default LongBreakDeloadModal;
