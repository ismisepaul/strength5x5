import React from 'react';
import { useTranslation } from 'react-i18next';
import { targetReps } from '../utils';

const RepPicker = ({ ex, setIdx, isDark, onSelect, onClose }) => {
  const { t } = useTranslation();
  const target = targetReps(ex);
  const options = Array.from({ length: target + 1 }, (_, i) => i);

  return (
    <div role="dialog" aria-modal="true" aria-label="Rep picker" className="fixed inset-0 z-[200] flex items-end justify-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
      <div className={`w-full max-w-md rounded-t-[14px] pt-[22px] px-5 pb-6 ${isDark ? 'bg-surface' : 'bg-surface-lt'}`}>
        <div className="mb-6">
          <h3 className="text-base font-semibold">{t('modals.repPickerTitle', { name: t('exercises.' + ex.id), set: setIdx + 1 })}</h3>
          <p className={`text-[11.5px] mt-1 ${isDark ? 'text-ink/50' : 'text-ink-lt/50'}`}>{t('modals.repPickerQuestion')}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {options.map(r => (
            <button
              key={r}
              onClick={() => onSelect(r)}
              aria-label={`${r} reps`}
              className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-semibold active:scale-90 transition-transform border ${r === target ? 'border-accent text-accent-300 bg-accent-900' : (isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60')}`}
            >{r}</button>
          ))}
        </div>
        <p className={`text-center text-[11px] mb-6 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.repPickerNote', { count: target })}</p>
        <div className="flex gap-3">
          <button onClick={() => onSelect(null)} className={`flex-1 h-10 rounded-lg border text-sm font-medium active:scale-95 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}>{t('modals.clearSet')}</button>
          <button onClick={onClose} className={`flex-1 h-10 rounded-lg border text-sm font-medium active:scale-95 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}>{t('modals.cancel')}</button>
        </div>
      </div>
    </div>
  );
};

export default RepPicker;
