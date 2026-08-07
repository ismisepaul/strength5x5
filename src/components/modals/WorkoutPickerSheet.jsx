import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '@phosphor-icons/react';
import { getProgram, topWeightOf } from '../../programs';
import Sheet from './Sheet';
import { Z_WORKOUT_PICKER } from './zIndex';

const WorkoutPickerSheet = ({ preset, program, weights, mcTop, mcInterval, mcPress, currentDay, moodLabel, onSelectDay, onClose }) => {
  const { t } = useTranslation();
  const prog = getProgram(preset);
  const programState = { program, weights, mcTop, mcInterval, mcPress };
  return (
    <Sheet ariaLabel={t('workout.todaysWorkout')} z={Z_WORKOUT_PICKER} onClose={onClose}>
      <h3 className="font-display font-semibold tracking-[-0.025em] text-lg mb-5">{t('workout.todaysWorkout')}</h3>
      <div className="space-y-3 mb-5">
        {prog.days.map(day => {
          const isCurrent = day === currentDay;
          const liftIds = prog.liftIds(day, programState);
          const dayExercises = prog.dayExercises(day, programState);
          const dayWeights = dayExercises.map(topWeightOf);
          const mood = moodLabel(day);
          return (
            <button
              key={day}
              onClick={() => onSelectDay(day)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-[10px] border text-left active:scale-[0.99] transition-transform ${isCurrent ? 'border-accent bg-accent-900' : 'border-ink/14'}`}
            >
              <span className={`w-9 h-9 rounded-lg border flex items-center justify-center font-semibold shrink-0 ${isCurrent ? 'border-accent text-accent-300' : 'border-ink/26'}`}>{day}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-display font-semibold tracking-[-0.025em] text-[14.5px]">{t(`workout.type${day}`)}</p>
                  {mood && <span className="text-kicker uppercase tracking-wide px-2 py-0.5 rounded-lg text-accent-300 bg-accent-900">{mood}</span>}
                </div>
                <p className="text-[12.5px] truncate text-ink/50">{liftIds.map(id => t('exercises.' + id)).join(' · ')}</p>
                <p className="font-display font-semibold text-meta tabular-nums text-ink/62">{dayWeights.join(' · ')} kg</p>
              </div>
              {isCurrent && <Check size={18} className="text-accent-300 shrink-0" />}
            </button>
          );
        })}
      </div>
      <p className="text-meta text-center mb-5 text-ink/62">{t('workout.scheduledNote')}</p>
      <button onClick={onClose} className="w-full h-[46px] flex items-center justify-center rounded-lg border text-[14px] font-medium active:scale-95 border-ink/26 text-ink">{t('modals.cancel')}</button>
    </Sheet>
  );
};

export default WorkoutPickerSheet;
