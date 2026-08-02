import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus, ArrowCounterClockwise } from '@phosphor-icons/react';
import { EXPECTED_WEIGHT_KEYS, MIN_SETS, MAX_SETS, MIN_REPS, MAX_REPS, DEFAULT_PROGRAM } from '../constants';

const ProgramEditor = ({ program, onChange, isDark, isWorkoutActive }) => {
  const { t } = useTranslation();

  const update = (id, field, delta, min, max) => {
    onChange(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: Math.min(max, Math.max(min, prev[id][field] + delta)) },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-3xl font-black uppercase tracking-tighter">{t('program.title')}</h2>
        <button
          onClick={() => onChange(() => JSON.parse(JSON.stringify(DEFAULT_PROGRAM)))}
          className={`flex items-center gap-1.5 text-[10px] font-black uppercase px-3 py-2 rounded-xl border active:scale-95 transition-transform ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}
        ><ArrowCounterClockwise size={12} /> {t('program.resetDefaults')}</button>
      </div>
      <p className="text-slate-500 text-xs font-bold leading-relaxed -mt-1">{t('program.subtitle')}</p>
      {isWorkoutActive && (
        <p className={`text-xs font-bold leading-relaxed p-4 rounded-2xl ${isDark ? 'bg-amber-950/20 text-amber-400' : 'bg-amber-50 text-amber-700'}`}>{t('program.activeWorkoutNote')}</p>
      )}

      {EXPECTED_WEIGHT_KEYS.map(id => {
        const { sets, reps } = program[id];
        return (
          <div key={id} className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <p className={`font-black text-sm uppercase mb-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{t('exercises.' + id)}</p>

            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{t('program.setsLabel')}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => update(id, 'sets', -1, MIN_SETS, MAX_SETS)}
                  aria-label={`Decrease ${id} sets`}
                  className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:scale-90`}
                ><Minus size={14} /></button>
                <span className="font-black w-6 text-center text-lg">{sets}</span>
                <button
                  onClick={() => update(id, 'sets', 1, MIN_SETS, MAX_SETS)}
                  aria-label={`Increase ${id} sets`}
                  className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:scale-90`}
                ><Plus size={14} /></button>
              </div>
            </div>

            <div className="flex gap-1.5 mb-5">
              {Array.from({ length: MAX_SETS }, (_, i) => (
                <div key={i} className={`flex-1 h-2 rounded-full ${i < sets ? 'bg-indigo-500' : (isDark ? 'bg-slate-800' : 'bg-slate-200')}`} />
              ))}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase">{t('program.repsLabel')}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => update(id, 'reps', -1, MIN_REPS, MAX_REPS)}
                  aria-label={`Decrease ${id} reps`}
                  className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:scale-90`}
                ><Minus size={14} /></button>
                <span className="font-black w-6 text-center text-lg">{reps}</span>
                <button
                  onClick={() => update(id, 'reps', 1, MIN_REPS, MAX_REPS)}
                  aria-label={`Increase ${id} reps`}
                  className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:scale-90`}
                ><Plus size={14} /></button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProgramEditor;
