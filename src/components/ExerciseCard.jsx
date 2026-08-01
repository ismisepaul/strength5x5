import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, Plus, Minus, X } from 'lucide-react';
import { calculateWarmup, targetReps } from '../utils';
import { MAX_SETS } from '../constants';

const LONG_PRESS_MS = 450;

const ExerciseCard = React.memo(({ ex, exIdx, isDark, onToggleSet, onShowPlates, expanded, onToggleWarmup, onUpdateWeight, onOpenRepPicker }) => {
  const { t } = useTranslation();
  const target = targetReps(ex);
  const pressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);

  const clearPressTimer = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  };

  const handlePointerDown = (setIdx) => {
    longPressFiredRef.current = false;
    clearPressTimer();
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onOpenRepPicker?.(exIdx, setIdx);
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => clearPressTimer();

  const handleClick = (setIdx) => {
    if (longPressFiredRef.current) { longPressFiredRef.current = false; return; }
    onToggleSet(exIdx, setIdx);
  };

  return (
    <div className={`p-6 rounded-[2.5rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className={`font-black text-lg truncate uppercase tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('exercises.' + ex.id)}</h3>
          <button onClick={() => onToggleWarmup(ex.id)} className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-lg mt-1 transition-colors ${expanded ? 'bg-indigo-600 text-white' : isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />} {t('warmup.warmup')}
          </button>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button onClick={() => onUpdateWeight(exIdx, -ex.increment)} aria-label={`Decrease ${t('exercises.' + ex.id)} weight`} className={`p-1.5 rounded-lg border ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Minus size={12} /></button>
            <span className={`text-2xl font-black ${isDark ? 'text-indigo-400' : 'text-indigo-600'} leading-none`}>{ex.weight}kg</span>
            <button onClick={() => onUpdateWeight(exIdx, ex.increment)} aria-label={`Increase ${t('exercises.' + ex.id)} weight`} className={`p-1.5 rounded-lg border ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Plus size={12} /></button>
          </div>
          <button onClick={() => onShowPlates(ex)} className="text-[10px] font-black block uppercase text-slate-500 mt-1">{t('warmup.plates')}</button>
        </div>
      </div>
      {expanded && (
        <div className={`mb-6 p-4 rounded-2xl ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1"><span>{t('warmup.emptyBar')}</span><span>20kg × 5</span></div>
          <div className="flex justify-between text-xs font-bold text-slate-500"><span>{t('warmup.workingPrep')}</span><span>{calculateWarmup(ex.weight)}kg × 3</span></div>
        </div>
      )}
      <div className="flex justify-between gap-2 items-center">
        {Array.from({ length: MAX_SETS }, (_, ri) => {
          if (ri >= ex.sets) {
            return (
              <div key={ri} className={`flex-1 aspect-square rounded-xl flex items-center justify-center border-4 border-dashed ${isDark ? 'border-slate-900 text-slate-800' : 'border-slate-100 text-slate-200'}`}>
                <X size={20} />
              </div>
            );
          }
          const r = ex.setsCompleted[ri];
          return (
            <button
              key={ri}
              onClick={() => handleClick(ri)}
              onPointerDown={() => handlePointerDown(ri)}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={`Set ${ri + 1}${r !== null ? `, ${r} reps` : ''}`}
              className={`flex-1 aspect-square rounded-xl flex items-center justify-center border-4 transition-all touch-manipulation active:scale-90 ${r !== null ? (r === target ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-rose-500 border-rose-600 text-white') : (isDark ? 'bg-slate-950 border-slate-800 text-slate-800' : 'bg-white border-slate-100 text-slate-200')}`}
            ><span className="text-xl font-black">{r !== null ? r : target}</span></button>
          );
        })}
      </div>
    </div>
  );
});

export default ExerciseCard;
