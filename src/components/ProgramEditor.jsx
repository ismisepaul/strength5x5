import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus } from '@phosphor-icons/react';
import { EXPECTED_WEIGHT_KEYS, MIN_SETS, MAX_SETS, MIN_REPS, MAX_REPS } from '../constants';
import StepperButton from './StepperButton';

// The per-exercise sets/reps customiser, embedded in ProgramTab's "Customise sets
// and reps" disclosure. Standard-only -- Madcow derives everything from top sets.
const ProgramEditor = ({ program, onChange, isDark }) => {
  const { t } = useTranslation();
  const mutedClass = isDark ? 'text-ink/45' : 'text-ink-lt/45';

  const update = (id, field, delta, min, max) => {
    onChange(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: Math.min(max, Math.max(min, prev[id][field] + delta)) },
    }));
  };

  return (
    <div className="space-y-4">
      {EXPECTED_WEIGHT_KEYS.map(id => {
        const { sets, reps } = program[id];
        return (
          <div key={id} className={`p-4 rounded-[10px] border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <div className="flex justify-between items-center mb-4">
              <p className="text-[15px] font-semibold">{t('exercises.' + id)}</p>
              <p className={`text-[12.5px] ${isDark ? 'text-ink/50' : 'text-ink-lt/50'}`}>
                {t('program.summary', { sets: t('program.setsCount', { count: sets }), reps: t('program.repsCount', { count: reps }) })}
              </p>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <span className={`w-9 text-[12px] uppercase ${mutedClass}`}>{t('program.setsLabel')}</span>
              <div className="flex-1 flex gap-1">
                {Array.from({ length: MAX_SETS }, (_, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full ${i < sets ? 'bg-accent' : (isDark ? 'bg-ink/12' : 'bg-ink-lt/12')}`} />
                ))}
              </div>
              <StepperButton
                onClick={() => update(id, 'sets', -1, MIN_SETS, MAX_SETS)}
                ariaLabel={`Decrease ${id} sets`}
                icon={Minus}
                isDark={isDark}
              />
              <span className="w-6 text-center text-[19px] tabular-nums">{sets}</span>
              <StepperButton
                onClick={() => update(id, 'sets', 1, MIN_SETS, MAX_SETS)}
                ariaLabel={`Increase ${id} sets`}
                icon={Plus}
                isDark={isDark}
              />
            </div>

            <div className="flex items-center gap-3">
              <span className={`w-9 text-[12px] uppercase ${mutedClass}`}>{t('program.repsLabel')}</span>
              <div className="flex-1 flex justify-between">
                {Array.from({ length: MAX_REPS }, (_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < reps ? 'bg-accent' : (isDark ? 'bg-ink/12' : 'bg-ink-lt/12')}`} />
                ))}
              </div>
              <StepperButton
                onClick={() => update(id, 'reps', -1, MIN_REPS, MAX_REPS)}
                ariaLabel={`Decrease ${id} reps`}
                icon={Minus}
                isDark={isDark}
              />
              <span className="w-6 text-center text-[19px] tabular-nums">{reps}</span>
              <StepperButton
                onClick={() => update(id, 'reps', 1, MIN_REPS, MAX_REPS)}
                ariaLabel={`Increase ${id} reps`}
                icon={Plus}
                isDark={isDark}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProgramEditor;
