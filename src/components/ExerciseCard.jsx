import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretUp, CaretDown, Plus, Minus, ArrowBendDownRight, X, PencilSimple } from '@phosphor-icons/react';
import { calculatePlates, targetReps } from '../utils';
import StepperButton from './StepperButton';

const LONG_PRESS_MS = 450;
const PLATE_HEIGHTS = { 25: 124, 20: 112, 15: 100, 10: 88, 5: 70, 2.5: 56, 1.25: 44 };

const ExerciseCard = React.memo(({ ex, exIdx, isDark, onToggleSet, onUpdateWeight, onOpenRepPicker, showHint, isEditingWeight, onStartEditWeight, onStopEditWeight }) => {
  const { t } = useTranslation();
  const target = targetReps(ex);
  const pressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const hasMissed = ex.setsCompleted.some(r => r !== null && r < target);
  const [panel, setPanel] = useState(null);
  const prepWeight = Math.round((20 + (ex.weight - 20) * 0.6) / 2.5) * 2.5;
  const plates = useMemo(() => calculatePlates(ex.weight), [ex.weight]);

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
            aria-label={`Edit ${t('exercises.' + ex.id)} weight`}
            className="flex items-center gap-1.5 min-h-[44px] shrink-0"
          >
            <span className="text-[20px] text-accent-300 tabular-nums leading-none">{ex.weight}kg</span>
            <PencilSimple size={13} className={isDark ? 'text-ink/35' : 'text-ink-lt/35'} />
          </button>
        </div>
        {isEditingWeight && (
          <div className={`mt-3 rounded-[9px] py-2 px-2.5 flex items-center gap-2 ${isDark ? 'bg-ground/60' : 'bg-ground-lt/60'}`}>
            <StepperButton onClick={() => onUpdateWeight(exIdx, -ex.increment)} ariaLabel={`Decrease ${t('exercises.' + ex.id)} weight`} icon={Minus} isDark={isDark} size={44} iconSize={15} />
            <span className="flex-1 text-center text-[22px] text-accent-300 tabular-nums">{ex.weight}kg</span>
            <StepperButton onClick={() => onUpdateWeight(exIdx, ex.increment)} ariaLabel={`Increase ${t('exercises.' + ex.id)} weight`} icon={Plus} isDark={isDark} size={44} iconSize={15} />
            <button
              onClick={onStopEditWeight}
              className="h-11 px-[18px] rounded-lg border border-accent text-accent text-[13px] font-semibold active:scale-95 shrink-0"
            >{t('workout.doneEditingWeight')}</button>
          </div>
        )}
      </div>
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
              className={`relative flex-1 aspect-square max-w-[62px] rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-90 ${stateClass}`}
            >
              <span className="text-[20px] font-semibold">{r !== null ? r : target}</span>
              {missed && (
                <span className="absolute -top-1 -right-1 w-[19px] h-[19px] rounded-full bg-neutral-tint flex items-center justify-center">
                  <X size={9} weight="bold" />
                </span>
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
          <div className="flex items-center justify-center gap-1">
            <div className="w-[30px] h-[11px] bg-neutral-tint rounded-l-[3px]" />
            <div className="w-[9px] h-[46px] bg-neutral-tint rounded-[3px]" />
            {plates.map((p, i) => (
              <div
                key={i}
                style={{ height: PLATE_HEIGHTS[p] ?? 44 }}
                className={`w-[26px] rounded-[6px] flex items-center justify-center text-[12px] font-semibold tabular-nums ${i === 0 ? 'bg-accent text-ground' : 'bg-neutral-tint text-ink'}`}
              >{p}</div>
            ))}
            <div className="h-[11px] rounded-r-[3px] bg-neutral-tint flex items-center px-[10px] text-[12px] font-semibold tabular-nums text-ink">20</div>
          </div>
          <p className={`text-center text-[11px] mt-3 ${isDark ? 'text-ink/40' : 'text-ink-lt/40'}`}>
            {ex.weight <= 20 ? t('warmup.emptyBarCaption') : t('warmup.perSideCaption', { total: ex.weight })}
          </p>
        </div>
      )}
    </div>
  );
});

export default ExerciseCard;
