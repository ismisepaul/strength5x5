import React from 'react';
import { useTranslation } from 'react-i18next';

// Technique steps for a single lift, shared by every surface that names an exercise
// (Program tab's day cards, Train's idle preview, and the active workout card) so
// "how do I do this lift" has one door regardless of which program is active.
const ExerciseGuideSheet = ({ liftId, isDark, onClose }) => {
  const { t } = useTranslation();
  const exerciseName = t('exercises.' + liftId);

  return (
    <div role="dialog" aria-modal="true" aria-label={t('technique.openAria', { exercise: exerciseName })} onClick={onClose} className="fixed inset-0 z-[500] flex items-end justify-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
      <div onClick={e => e.stopPropagation()} className={`w-full max-w-md rounded-t-[14px] pt-[22px] px-5 pb-6 ${isDark ? 'bg-surface' : 'bg-surface-lt'}`}>
        <h3 className="text-lg font-semibold mb-5">{exerciseName}</h3>
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain space-y-3 mb-6">
          {t('technique.steps.' + liftId, { returnObjects: true }).map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-[22px] h-[22px] shrink-0 rounded-full border border-accent/50 text-accent-300 text-[11px] font-semibold flex items-center justify-center tabular-nums">{i + 1}</span>
              <p className={`text-[13px] leading-[1.5] ${isDark ? 'text-ink/70' : 'text-ink-lt/70'}`}>{step}</p>
            </div>
          ))}
        </div>
        <button autoFocus onClick={onClose} className={`w-full h-[46px] flex items-center justify-center rounded-lg border text-[14px] font-medium active:scale-95 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}>{t('technique.close')}</button>
      </div>
    </div>
  );
};

export default ExerciseGuideSheet;
