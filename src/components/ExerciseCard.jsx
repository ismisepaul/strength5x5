import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretUp, CaretDown, ArrowBendDownRight, Info, X } from '@phosphor-icons/react';
import { targetReps } from '../utils';
import { MAX_SETS } from '../constants';
import WeightInput from './WeightInput';
import BarSetupDiagram from './BarSetupDiagram';

const LONG_PRESS_MS = 450;

const ExerciseCard = React.memo(({ ex, exIdx, onToggleSet, onOpenRepPicker, showHint, onWeightChange, topSetValue, topSetMin, onTopSetChange, onOpenGuide }) => {
  const { t } = useTranslation();
  const isRamped = Array.isArray(ex.setWeights);
  // A ramp's "top set" is its heaviest -- the last rung, except on a back-off day
  // (identified by an 8-rep set) where the triple just before it is the real top.
  const hasBackoff = isRamped && ex.setReps.includes(8);
  const topIndex = isRamped ? (hasBackoff ? ex.setWeights.length - 2 : ex.setWeights.length - 1) : -1;
  const backoffIndex = hasBackoff ? ex.setWeights.length - 1 : -1;
  const topWeight = isRamped ? ex.setWeights[topIndex] : ex.weight;
  const bottomWeight = isRamped ? Math.min(...ex.setWeights) : ex.weight;

  const pressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const hasMissed = ex.setsCompleted.some((r, i) => r !== null && r < targetReps(ex, i));
  const [panel, setPanel] = useState(null);
  const prepWeight = Math.round((20 + (topWeight - 20) * 0.6) / 2.5) * 2.5;

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

  const mutedClass = 'text-ink/45';

  return (
    <div className={`p-4 rounded-[10px] border bg-surface border-ink/8`}>
      <div className="mb-5">
        <div className={`flex justify-between ${isRamped ? 'items-start' : 'items-center'}`}>
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-semibold text-[17px] truncate">{t('exercises.' + ex.id)}</h3>
              <button
                onClick={onOpenGuide}
                aria-label={t('technique.openAria', { exercise: t('exercises.' + ex.id) })}
                className={`shrink-0 w-6 h-6 flex items-center justify-center ${mutedClass}`}
              ><Info size={15} /></button>
            </div>
            {isRamped && (
              <p className={`text-[12.5px] tabular-nums ${mutedClass}`}>{t('workout.rampSetsMeta', { sets: ex.sets, from: bottomWeight, to: topWeight })}</p>
            )}
          </div>
          {isRamped ? (
            <WeightInput
              value={topSetValue}
              increment={ex.increment}
              min={topSetMin}
              onChange={onTopSetChange}
              label={t('exercises.' + ex.id)}
              variant="prominent"
              topSet
            />
          ) : (
            <WeightInput
              value={ex.weight}
              increment={ex.increment}
              min={20}
              onChange={onWeightChange}
              label={t('exercises.' + ex.id)}
              variant="prominent"
            />
          )}
        </div>
      </div>
      <div className="flex justify-start gap-2 items-center">
        {ex.setsCompleted.map((r, ri) => {
          const target = targetReps(ex, ri);
          const passed = r !== null && r === target;
          const missed = r !== null && r < target;
          let stateClass;
          if (passed) stateClass = 'border border-accent bg-accent-900 text-accent-300';
          else if (missed) stateClass = 'border-[1.5px] border-transparent bg-neutral-tint text-ink';
          else stateClass = 'border border-ink/18 text-ink/40';
          const missedDasharray = r === 0 ? '0.5 24' : `3 ${Math.min(24, 3 * (target - r))}`;
          return (
            <div key={ri} className="flex flex-col items-center gap-1" style={{ width: `calc((100% - ${8 * (MAX_SETS - 1)}px) / ${MAX_SETS})` }}>
              <button
                onClick={() => handleClick(ri)}
                onPointerDown={() => handlePointerDown(ri)}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={`Set ${ri + 1}${r !== null ? `, ${r} reps` : ''}`}
                className={`relative shrink-0 w-full aspect-square max-w-[62px] rounded-full flex items-center justify-center transition-all touch-manipulation active:scale-90 ${stateClass}`}
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
              {isRamped && <span className={`text-kicker tabular-nums ${ri === topIndex ? 'font-semibold text-accent-300' : mutedClass}`}>{ex.setWeights[ri]}</span>}
            </div>
          );
        })}
      </div>
      {hasMissed && (
        <p className="flex items-center gap-1 text-[12.5px] mt-3">
          <ArrowBendDownRight size={13} className="text-accent shrink-0" />
          <span className="text-ink/55">
            {isRamped ? t('workout.missedNoteTopSet') : t('workout.missedNote', { weight: ex.weight })}
          </span>
        </p>
      )}
      {showHint && (
        <p className={`text-meta mt-3 text-ink/38`}>{t('workout.setHint', { count: targetReps(ex, 0) })}</p>
      )}
      <div className={`mt-4 pt-3 flex items-center justify-between rule-fade-top`}>
        <button
          onClick={() => setPanel(p => p === 'warm' ? null : 'warm')}
          aria-expanded={panel === 'warm'}
          className={`flex items-center gap-1 min-h-9 text-[12.5px] font-medium ${panel === 'warm' ? 'text-accent-300' : mutedClass}`}
        >
          {panel === 'warm' ? <CaretUp size={11} /> : <CaretDown size={11} />}
          {t(isRamped ? 'workout.rampDisclosure' : 'warmup.warmup')}
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
        <div className={`mt-2 rounded-[9px] p-3.5 space-y-2 bg-ground/60`}>
          {isRamped ? ex.setWeights.map((w, i) => {
            const isTop = i === topIndex;
            const isBackoff = i === backoffIndex;
            const label = isTop ? t('workout.rampTopSetLabel', { n: i + 1 }) : isBackoff ? t('workout.rampBackoffLabel', { n: i + 1 }) : t('workout.rampSetLabel', { n: i + 1 });
            return (
              <div key={i} className={`flex justify-between text-[13px] tabular-nums ${isTop ? 'text-accent-300' : mutedClass}`}>
                <span>{label}</span><span>{w} kg × {ex.setReps[i]}</span>
              </div>
            );
          }) : (
            <>
              <div className={`flex justify-between text-[13px] tabular-nums ${mutedClass}`}>
                <span>{t('warmup.emptyBar')}</span><span>20 kg × 5</span>
              </div>
              <div className={`flex justify-between text-[13px] tabular-nums ${mutedClass}`}>
                <span>{t('warmup.prep')}</span><span>{prepWeight} kg × 3</span>
              </div>
              <div className="flex justify-between text-[13px] tabular-nums text-accent-300">
                <span>{t('warmup.workingWeight')}</span><span>{ex.weight} kg × {targetReps(ex, 0)}</span>
              </div>
            </>
          )}
        </div>
      )}
      {panel === 'bar' && (
        <div className={`mt-2 rounded-[9px] p-3.5 bg-ground/60`}>
          <BarSetupDiagram weight={topWeight} />
        </div>
      )}
    </div>
  );
});

export default ExerciseCard;
