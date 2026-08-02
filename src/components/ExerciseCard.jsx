import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretUp, CaretDown, Plus, Minus, ArrowBendDownRight, X } from '@phosphor-icons/react';
import { calculateWarmup, targetReps } from '../utils';

const LONG_PRESS_MS = 450;

const ExerciseCard = React.memo(({ ex, exIdx, isDark, onToggleSet, onShowPlates, expanded, onToggleWarmup, onUpdateWeight, onOpenRepPicker, showHint }) => {
  const { t } = useTranslation();
  const target = targetReps(ex);
  const pressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const hasMissed = ex.setsCompleted.some(r => r !== null && r < target);

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

  const mutedClass = isDark ? 'text-ink/45' : 'text-ink-lt/45';

  return (
    <div className={`p-4 rounded-[10px] border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
      <div className="flex justify-between items-start mb-5">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="font-semibold text-[15px] truncate">{t('exercises.' + ex.id)}</h3>
          <div className="flex items-center gap-3 mt-1">
            <button onClick={() => onToggleWarmup(ex.id)} className="flex items-center gap-1 text-[11px] text-accent">
              {t('warmup.warmup')} {expanded ? <CaretUp size={10} /> : <CaretDown size={10} />}
            </button>
            <button onClick={() => onShowPlates(ex)} className={`text-[11px] ${mutedClass}`}>{t('warmup.plates')}</button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onUpdateWeight(exIdx, -ex.increment)} aria-label={`Decrease ${t('exercises.' + ex.id)} weight`} className={`w-7 h-7 rounded-lg border flex items-center justify-center ${isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60'} active:scale-90`}><Minus size={14} /></button>
          <span className="text-[17px] text-accent-300 tabular-nums leading-none">{ex.weight}kg</span>
          <button onClick={() => onUpdateWeight(exIdx, ex.increment)} aria-label={`Increase ${t('exercises.' + ex.id)} weight`} className={`w-7 h-7 rounded-lg border flex items-center justify-center ${isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60'} active:scale-90`}><Plus size={14} /></button>
        </div>
      </div>
      {expanded && (
        <div className={`mb-5 p-3 rounded-lg ${isDark ? 'bg-surface-deep' : 'bg-surface-deep-lt'}`}>
          <div className={`flex justify-between text-xs mb-1 ${mutedClass}`}><span>{t('warmup.emptyBar')}</span><span>20kg × 5</span></div>
          <div className={`flex justify-between text-xs ${mutedClass}`}><span>{t('warmup.workingPrep')}</span><span>{calculateWarmup(ex.weight)}kg × 3</span></div>
        </div>
      )}
      <div className="flex justify-between gap-2 items-center">
        {ex.setsCompleted.map((r, ri) => {
          const passed = r !== null && r === target;
          const missed = r !== null && r < target;
          let stateClass;
          if (passed) stateClass = 'border border-accent bg-accent-900 text-accent-300';
          else if (missed) stateClass = 'border-[1.5px] border-dashed border-ink/50 bg-neutral-tint text-ink';
          else stateClass = isDark ? 'border border-ink/18 text-ink/40' : 'border border-ink-lt/18 text-ink-lt/40';
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
              className={`relative flex-1 aspect-square max-w-[52px] rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-90 ${stateClass}`}
            >
              <span className="text-base font-semibold">{r !== null ? r : target}</span>
              {missed && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neutral-tint flex items-center justify-center">
                  <X size={8} weight="bold" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hasMissed && (
        <p className="flex items-center gap-1 text-[11px] mt-3">
          <ArrowBendDownRight size={11} className="text-accent shrink-0" />
          <span className={isDark ? 'text-ink/55' : 'text-ink-lt/55'}>{t('workout.missedNote', { weight: ex.weight })}</span>
        </p>
      )}
      {showHint && (
        <p className={`text-[10.5px] mt-3 ${isDark ? 'text-ink/38' : 'text-ink-lt/38'}`}>{t('workout.setHint', { count: target })}</p>
      )}
    </div>
  );
});

export default ExerciseCard;
