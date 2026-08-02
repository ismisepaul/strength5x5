import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, ArrowCounterClockwise, CaretUp, CaretDown } from '@phosphor-icons/react';
import { EXPECTED_WEIGHT_KEYS, MIN_SETS, MAX_SETS, MIN_REPS, MAX_REPS, DEFAULT_PROGRAM } from '../constants';
import StepperButton from './StepperButton';

const ProgramEditor = ({ program, onChange, isDark, isWorkoutActive }) => {
  const { t } = useTranslation();
  const [openHowTo, setOpenHowTo] = useState({});
  const mutedClass = isDark ? 'text-ink/45' : 'text-ink-lt/45';

  const update = (id, field, delta, min, max) => {
    onChange(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: Math.min(max, Math.max(min, prev[id][field] + delta)) },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-[24px] font-medium">{t('program.title')}</h2>
        <button
          onClick={() => onChange(() => JSON.parse(JSON.stringify(DEFAULT_PROGRAM)))}
          className={`flex items-center gap-1.5 text-[12px] uppercase px-3 py-2 rounded-lg border active:scale-95 transition-transform ${isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60'}`}
        ><ArrowCounterClockwise size={14} /> {t('program.resetToDefault')}</button>
      </div>
      <p className={`text-[13.5px] leading-relaxed -mt-1 ${mutedClass}`}>{t('program.standard.customiseNote')}</p>
      {isWorkoutActive && (
        <p className={`text-[13.5px] leading-relaxed ${mutedClass}`}>{t('program.standard.note')}</p>
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

            <button
              onClick={() => setOpenHowTo(prev => ({ ...prev, [id]: !prev[id] }))}
              aria-expanded={!!openHowTo[id]}
              className={`flex items-center gap-1 min-h-9 mt-3 text-[12.5px] font-medium ${openHowTo[id] ? 'text-accent-300' : mutedClass}`}
            >
              {t('program.howTo')}
              {openHowTo[id] ? <CaretUp size={11} /> : <CaretDown size={11} />}
            </button>
            {openHowTo[id] && (
              <div className={`mt-2 rounded-[9px] p-3.5 space-y-3 ${isDark ? 'bg-ground/60' : 'bg-ground-lt/60'}`}>
                {t('program.howToSteps.' + id, { returnObjects: true }).map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span
                      className="w-[22px] h-[22px] shrink-0 rounded-full border border-accent/50 text-accent-300 text-[11px] font-semibold flex items-center justify-center tabular-nums"
                    >{i + 1}</span>
                    <p className={`text-[13px] leading-[1.5] ${isDark ? 'text-ink/70' : 'text-ink-lt/70'}`}>{step}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProgramEditor;
