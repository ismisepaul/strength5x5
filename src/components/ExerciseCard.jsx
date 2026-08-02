import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretUp, CaretDown, ArrowBendDownRight, X, PencilSimple } from '@phosphor-icons/react';
import { targetReps } from '../utils';
import WeightEditBar from './WeightEditBar';
import BarSetupDiagram from './BarSetupDiagram';

const LONG_PRESS_MS = 450;

const ExerciseCard = React.memo(({ ex, exIdx, isDark, onToggleSet, onOpenRepPicker, showHint, isEditingWeight, draftWeight, onDraftWeightChange, onStartEditWeight, onStepWeight, onCommitWeight, onCancelEditWeight }) => {
  const { t } = useTranslation();
  const target = targetReps(ex);
  const pressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const hasMissed = ex.setsCompleted.some(r => r !== null && r < target);
  const [panel, setPanel] = useState(null);
  const prepWeight = Math.round((20 + (ex.weight - 20) * 0.6) / 2.5) * 2.5;

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
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[17px] truncate flex-1 min-w-0 pr-4">{t('exercises.' + ex.id)}</h3>
          <button
            onClick={onStartEditWeight}
            aria-label={t('workout.editWeightAria', { name: t('exercises.' + ex.id) })}
            className="flex items-center gap-1.5 min-h-[44px] shrink-0"
          >
            <span className="text-[20px] text-accent-300 tabular-nums leading-none">{ex.weight}kg</span>
            <PencilSimple size={13} className={isDark ? 'text-ink/35' : 'text-ink-lt/35'} />
          </button>
        </div>
        {isEditingWeight && (
          <WeightEditBar
            value={draftWeight}
            onChange={onDraftWeightChange}
            onDecrement={() => onStepWeight(-ex.increment)}
            onIncrement={() => onStepWeight(ex.increment)}
            onCommit={onCommitWeight}
            onCancel={onCancelEditWeight}
            isDark={isDark}
            variant="card"
            exerciseName={t('exercises.' + ex.id)}
          />
        )}
      </div>
      <div className="flex justify-between gap-2 items-center">
        {ex.setsCompleted.map((r, ri) => {
          const passed = r !== null && r === target;
          const missed = r !== null && r < target;
          let stateClass;
          if (passed) stateClass = 'border border-accent bg-accent-900 text-accent-300';
          else if (missed) stateClass = 'border-[1.5px] border-transparent bg-neutral-tint text-ink';
          else stateClass = isDark ? 'border border-ink/18 text-ink/40' : 'border border-ink-lt/18 text-ink-lt/40';
          const missedDasharray = r === 0 ? '0.5 24' : `3 ${Math.min(24, 3 * (target - r))}`;
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
              className={`relative flex-1 aspect-square max-w-[62px] rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-90 ${stateClass}`}
            >
              <span className="text-[20px] font-semibold">{r !== null ? r : target}</span>
              {missed && (
                <>
                  <svg
                    viewBox="0 0 100 100"
                    className="absolute pointer-events-none"
                    style={{ inset: '-1.5px', width: 'calc(100% + 3px)', height: 'calc(100% + 3px)' }}
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="none"
                      stroke="rgba(233,233,237,.55)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      pathLength="100"
                      transform="rotate(-90 50 50)"
                      strokeDasharray={missedDasharray}
                    />
                  </svg>
                  <span className="absolute -top-1 -right-1 w-[19px] h-[19px] rounded-full bg-neutral-tint flex items-center justify-center">
                    <X size={9} weight="bold" />
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      {hasMissed && (
        <p className="flex items-center gap-1 text-[12.5px] mt-3">
          <ArrowBendDownRight size={13} className="text-accent shrink-0" />
          <span className={isDark ? 'text-ink/55' : 'text-ink-lt/55'}>{t('workout.missedNote', { weight: ex.weight })}</span>
        </p>
      )}
      {showHint && (
        <p className={`text-[12px] mt-3 ${isDark ? 'text-ink/38' : 'text-ink-lt/38'}`}>{t('workout.setHint', { count: target })}</p>
      )}
      <div className={`mt-4 pt-3 flex items-center justify-between ${isDark ? 'rule-fade-top' : 'rule-fade-top-lt'}`}>
        <button
          onClick={() => setPanel(p => p === 'warm' ? null : 'warm')}
          aria-expanded={panel === 'warm'}
          className={`flex items-center gap-1 min-h-9 text-[12.5px] font-medium ${panel === 'warm' ? 'text-accent-300' : mutedClass}`}
        >
          {panel === 'warm' ? <CaretUp size={11} /> : <CaretDown size={11} />}
          {t('warmup.warmup')}
        </button>
        <button
          onClick={() => setPanel(p => p === 'bar' ? null : 'bar')}
          aria-expanded={panel === 'bar'}
          className={`flex items-center gap-1 min-h-9 text-[12.5px] font-medium ${panel === 'bar' ? 'text-accent-300' : mutedClass}`}
        >
          {t('warmup.barSetup')}
          {panel === 'bar' ? <CaretUp size={11} /> : <CaretDown size={11} />}
        </button>
      </div>
      {panel === 'warm' && (
        <div className={`mt-2 rounded-[9px] p-3.5 space-y-2 ${isDark ? 'bg-ground/60' : 'bg-ground-lt/60'}`}>
          <div className={`flex justify-between text-[13px] tabular-nums ${mutedClass}`}>
            <span>{t('warmup.emptyBar')}</span><span>20 kg × 5</span>
          </div>
          <div className={`flex justify-between text-[13px] tabular-nums ${mutedClass}`}>
            <span>{t('warmup.prep')}</span><span>{prepWeight} kg × 3</span>
          </div>
          <div className="flex justify-between text-[13px] tabular-nums text-accent-300">
            <span>{t('warmup.workingWeight')}</span><span>{ex.weight} kg × {target}</span>
          </div>
        </div>
      )}
      {panel === 'bar' && (
        <div className={`mt-2 rounded-[9px] p-3.5 ${isDark ? 'bg-ground/60' : 'bg-ground-lt/60'}`}>
          <BarSetupDiagram weight={ex.weight} isDark={isDark} />
        </div>
      )}
    </div>
  );
});

export default ExerciseCard;
