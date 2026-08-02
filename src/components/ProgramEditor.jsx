import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, ArrowCounterClockwise } from '@phosphor-icons/react';
import { EXPECTED_WEIGHT_KEYS, MIN_SETS, MAX_SETS, MIN_REPS, MAX_REPS, DEFAULT_PROGRAM } from '../constants';

const ProgramEditor = ({ program, onChange, isDark, isWorkoutActive }) => {
  const { t } = useTranslation();
  const mutedClass = isDark ? 'text-ink/45' : 'text-ink-lt/45';

  const update = (id, field, delta, min, max) => {
    onChange(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: Math.min(max, Math.max(min, prev[id][field] + delta)) },
    }));
  };

  const stepperClass = `w-[46px] h-[46px] rounded-lg border flex items-center justify-center shrink-0 transition-colors hover:border-accent ${isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60'}`;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-[24px] font-medium">{t('program.title')}</h2>
        <button
          onClick={() => onChange(() => JSON.parse(JSON.stringify(DEFAULT_PROGRAM)))}
          className={`flex items-center gap-1.5 text-[12px] uppercase px-3 py-2 rounded-lg border active:scale-95 transition-transform ${isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60'}`}
        ><ArrowCounterClockwise size={14} /> {t('program.resetDefaults')}</button>
      </div>
      <p className={`text-[13.5px] leading-relaxed -mt-1 ${mutedClass}`}>{t('program.subtitle')}</p>
      {isWorkoutActive && (
        <p className={`text-[13.5px] leading-relaxed ${mutedClass}`}>{t('program.activeWorkoutNote')}</p>
      )}

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
              <button
                onClick={() => update(id, 'sets', -1, MIN_SETS, MAX_SETS)}
                aria-label={`Decrease ${id} sets`}
                className={stepperClass}
              ><Minus size={18} /></button>
              <span className="w-6 text-center text-[19px] tabular-nums">{sets}</span>
              <button
                onClick={() => update(id, 'sets', 1, MIN_SETS, MAX_SETS)}
                aria-label={`Increase ${id} sets`}
                className={stepperClass}
              ><Plus size={18} /></button>
            </div>

            <div className="flex items-center gap-3">
              <span className={`w-9 text-[12px] uppercase ${mutedClass}`}>{t('program.repsLabel')}</span>
              <div className="flex-1 flex gap-1">
                {Array.from({ length: MAX_REPS }, (_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < reps ? 'bg-accent' : (isDark ? 'bg-ink/12' : 'bg-ink-lt/12')}`} />
                ))}
              </div>
              <button
                onClick={() => update(id, 'reps', -1, MIN_REPS, MAX_REPS)}
                aria-label={`Decrease ${id} reps`}
                className={stepperClass}
              ><Minus size={18} /></button>
              <span className="w-6 text-center text-[19px] tabular-nums">{reps}</span>
              <button
                onClick={() => update(id, 'reps', 1, MIN_REPS, MAX_REPS)}
                aria-label={`Increase ${id} reps`}
                className={stepperClass}
              ><Plus size={18} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProgramEditor;
