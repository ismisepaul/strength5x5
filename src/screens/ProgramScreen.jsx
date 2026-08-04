import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Barbell, CaretRight, CaretDown, CaretUp, ArrowCounterClockwise } from '@phosphor-icons/react';
import { DEFAULT_PROGRAM, MADCOW_ONRAMP_WEEKS, MADCOW_INTERVAL_OPTIONS, MADCOW_PRESS_OPTIONS, INITIAL_WEIGHTS } from '../constants';
import { computeProjectedVolume, wentUpLastTime, madcowPhase, targetReps, seedMadcowTops, seedInclineWeight } from '../utils';
import { getProgram, PROGRAM_IDS, programAllLiftIds, topWeightOf } from '../programs';
import ProgramEditor from '../components/ProgramEditor';
import WeightInput from '../components/WeightInput';
import Segmented from '../components/Segmented';

// Minimum horizontal drag, in px, before a pointer up/down pair on the week card
// counts as a swipe rather than a tap on something inside it (e.g. "back to current").
const WEEK_SWIPE_THRESHOLD = 40;

const Kicker = ({ children }) => (
  <div className="flex items-center gap-3">
    <span className="text-tab font-semibold uppercase tracking-[0.14em] text-accent shrink-0">{children}</span>
    <div className={`flex-1 h-px bg-gradient-to-r from-ink/15 to-transparent`} />
  </div>
);

const Badge = ({ children }) => (
  <span className="text-tab uppercase tracking-wide px-2.5 py-1 rounded-lg text-accent-300 bg-accent-900 shrink-0">{children}</span>
);

const Chip = ({ children }) => (
  <span className={`text-tab px-2.5 py-1 rounded-lg border border-ink/18 text-ink/60`}>{children}</span>
);

// A read-only readout, not a control: thin flat bars, height proportional to
// weight, role (top / back-off / plain) carried by the border only -- never by
// fill colour. Deliberately not styled like the Train tab's tappable set circles.
const RampBars = ({ ex, day }) => {
  const n = ex.setWeights.length;
  const hasTop = day === 'A' || day === 'B' || day === 'C';
  const topIndex = day === 'C' ? n - 2 : n - 1;
  const backoffIndex = day === 'C' ? n - 1 : -1;
  const min = Math.min(...ex.setWeights);
  const max = Math.max(...ex.setWeights);

  return (
    <div className="flex items-end gap-1.5 mt-[9px]">
      {ex.setWeights.map((w, i) => {
        const reps = ex.setReps[i];
        const isTop = hasTop && i === topIndex;
        const isBackoff = hasTop && i === backoffIndex;
        const height = max === min ? 52 : 26 + 28 * (w - min) / (max - min);
        return (
          <div key={i} className="flex-1 flex flex-col items-center min-w-0">
            <span className="text-kicker font-semibold text-accent-300 tabular-nums h-[13px] leading-[13px]">{reps !== 5 ? `×${reps}` : ''}</span>
            <div
              style={{ height: `${height}px` }}
              className={`w-full rounded-t-[4px] rounded-b-[2px] bg-accent/40 ${
                isTop ? 'border border-accent'
                  : isBackoff ? 'border border-dashed border-accent/45'
                    : 'border border-accent/35'
              }`}
            />
            <span className={`text-tab tabular-nums mt-1.5 leading-none ${isTop ? 'text-accent-300' : ('text-ink/50')}`}>{w}</span>
          </div>
        );
      })}
    </div>
  );
};

const ProgramScreen = ({
  isWorkoutActive, preset, program, onChangeProgram, weights, history,
  mcTop, mcWeek, mcInterval, mcPress, onUpdateMcTop, onChangeMcInterval, onChangeMcPress,
  onRecalculate, currentWorkoutType, mcNextDay, programSheet, setProgramSheet, onSwitchProgram,
  onOpenGuide,
}) => {
  const { t } = useTranslation();
  const mutedClass = 'text-ink/45';
  const cardClass = `p-4 rounded-[10px] border bg-surface border-ink/8`;

  const [selectedWorkout, setSelectedWorkout] = useState(currentWorkoutType);
  const [selectedDay, setSelectedDay] = useState(mcNextDay);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [previewWeek, setPreviewWeek] = useState(null);
  const weekSwipeStartXRef = useRef(null);

  const prog = getProgram(preset);
  const isMadcow = prog.ramped;
  const programState = { program, weights, mcTop, mcInterval, mcPress };
  const programChanged = JSON.stringify(program) !== JSON.stringify(DEFAULT_PROGRAM);
  const showReset = isMadcow || programChanged;
  const moodBadge = (day) => {
    const mood = prog.dayMood(day);
    return mood ? t('program.madcow.mood' + mood.charAt(0).toUpperCase() + mood.slice(1)) : '';
  };

  const openPicker = () => setProgramSheet({ step: 'pick' });
  const selectProgram = (target) => {
    if (target === preset) { setProgramSheet(null); return; }
    setProgramSheet({ step: 'confirm', target });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3">
        <h2 className="text-title font-medium">{t('program.title')}</h2>
        {showReset && (
          <button
            onClick={isMadcow ? onRecalculate : () => onChangeProgram(() => JSON.parse(JSON.stringify(DEFAULT_PROGRAM)))}
            className={`flex items-center gap-1.5 text-meta uppercase px-3 py-2 rounded-lg border active:scale-95 transition-transform shrink-0 border-ink/18 text-ink/60`}
          ><ArrowCounterClockwise size={14} /> {t(isMadcow ? 'program.recalculate' : 'program.resetToDefault')}</button>
        )}
      </div>

      <button
        onClick={openPicker}
        aria-label={t('program.picker.title')}
        className="w-full flex items-center gap-3 p-4 rounded-[10px] border border-accent bg-accent-900 text-left active:scale-[0.99] transition-transform"
      >
        <Barbell weight="fill" size={20} className="text-accent-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[16px] truncate">{t(prog.nameKey)}</p>
          <p className={`text-[12.5px] text-ink/55`}>{t(prog.subKey)}</p>
        </div>
        <span className="flex items-center gap-1 text-body text-accent-300 shrink-0">{t('program.strip.change')} <CaretRight size={14} /></span>
      </button>

      <Kicker>{t(isMadcow ? 'program.kickerThisWeek' : 'program.kickerTheProgram')}</Kicker>

      {isMadcow ? (() => {
        // null = showing the live current week. Swiping the card left/right previews
        // an on-ramp week's phase/note without touching mcWeek; landing back on the
        // live week (or tapping "back to current") returns to the live view.
        const displayWeek = previewWeek ?? mcWeek;
        const isPreviewing = previewWeek !== null && previewWeek !== mcWeek;
        const phase = madcowPhase(displayWeek, MADCOW_ONRAMP_WEEKS);
        const dayExercises = prog.dayExercises(selectedDay, programState);
        const liftIds = prog.liftIds(selectedDay, programState);
        const volume = computeProjectedVolume(dayExercises).toLocaleString();
        const onrampDots = Array.from({ length: MADCOW_ONRAMP_WEEKS }, (_, i) => i + 1);

        // touch-action: pan-y hands horizontal drags to us instead of letting the
        // browser's own gesture recognizer claim them for the page's vertical scroll --
        // without it, the browser fires pointercancel mid-swipe (never pointerup) the
        // moment it decides the touch is a scroll, so the gesture silently never lands.
        // No pointer capture here: it would retarget the eventual click to this div,
        // breaking the "back to current week" button nested inside it.
        const handleWeekPointerDown = (e) => { weekSwipeStartXRef.current = e.clientX; };
        const handleWeekPointerUp = (e) => {
          const startX = weekSwipeStartXRef.current;
          weekSwipeStartXRef.current = null;
          if (startX === null) return;
          const deltaX = e.clientX - startX;
          if (Math.abs(deltaX) < WEEK_SWIPE_THRESHOLD) return;
          const next = Math.min(MADCOW_ONRAMP_WEEKS, Math.max(1, displayWeek + (deltaX < 0 ? 1 : -1)));
          setPreviewWeek(next === mcWeek ? null : next);
        };

        return (
          <>
            <div
              className={`${cardClass} touch-pan-y select-none`}
              onPointerDown={handleWeekPointerDown}
              onPointerUp={handleWeekPointerUp}
              onPointerCancel={() => { weekSwipeStartXRef.current = null; }}
              role="group"
              aria-label={t('program.madcow.weekSwipeAria')}
            >
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-[16px]">{t('program.madcow.weekLabel', { week: displayWeek })}</p>
                <Badge>{t(`program.madcow.phase${phase === 'onramp' ? 'Onramp' : phase === 'matching' ? 'Matching' : 'Record'}`)}</Badge>
              </div>
              {/* A pagination indicator, not a progress bar -- only whichever week is
                  on screen right now is filled (and widens into a dash); every other
                  week, past or future, stays a hollow dot. */}
              <div className="flex items-center gap-1.5 mb-1">
                {onrampDots.map(w => {
                  const selected = displayWeek === w;
                  return (
                    <div
                      key={w}
                      className={`h-2 rounded-full border transition-[width] ${selected ? 'w-6 bg-accent border-accent' : 'w-2 border-accent/50'}`}
                    />
                  );
                })}
              </div>
              <p className={`text-meta leading-relaxed mb-3 ${mutedClass}`}>{t('program.madcow.weekSwipeHint')}</p>
              {/* All three notes stacked in the same grid cell so the row reserves
                  height for the tallest one -- swiping between phases with different
                  text lengths changes the words, never the card's height. */}
              <div className="grid text-body leading-relaxed">
                {['onramp', 'matching', 'record'].map(p => (
                  <p
                    key={p}
                    className={`col-start-1 row-start-1 ${mutedClass} ${phase === p ? '' : 'invisible'}`}
                    aria-hidden={phase !== p}
                  >
                    {t(`program.madcow.${p === 'onramp' ? 'onrampNote' : p === 'matching' ? 'matchingNote' : 'recordNote'}`)}
                  </p>
                ))}
              </div>
              <div className="grid mt-3">
                <button
                  onClick={() => setPreviewWeek(null)}
                  className={`col-start-1 row-start-1 text-left text-[13px] text-accent-300 active:scale-95 ${isPreviewing ? '' : 'invisible'}`}
                  aria-hidden={!isPreviewing}
                >
                  {t('program.madcow.backToCurrentWeek')}
                </button>
                <p
                  className={`col-start-1 row-start-1 text-[13px] text-accent-300 ${isPreviewing ? 'invisible' : ''}`}
                  aria-hidden={isPreviewing}
                >
                  {t('program.madcow.nextSession', { workout: t(`workout.type${mcNextDay}`), mood: moodBadge(mcNextDay) })}
                </p>
              </div>
            </div>

            <Segmented variant="medium" value={selectedDay} onChange={setSelectedDay} options={prog.days.map(d => ({ val: d, label: t(`workout.type${d}`) }))} />

            <div className={cardClass}>
              <div className="flex justify-between items-center mb-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold text-[16px] truncate">{t(`workout.type${selectedDay}`)}</p>
                  <Badge>{moodBadge(selectedDay)}</Badge>
                </div>
                <span className={`text-[12.5px] shrink-0 ${mutedClass}`}>{t('program.madcow.kgLifted', { value: volume })}</span>
              </div>
              <p className={`text-body leading-relaxed mb-1 ${mutedClass}`}>{t(`program.madcow.day${selectedDay}Note`)}</p>
              <p className={`text-meta leading-relaxed mb-4 ${mutedClass}`}>{t('technique.hint')}</p>
              {dayExercises.map((ex, i) => (
                <div key={ex.id} className={i > 0 ? `mt-4 pt-4 rule-fade-top` : ''}>
                  <button
                    onClick={() => onOpenGuide(liftIds[i])}
                    aria-label={t('technique.openAria', { exercise: t('exercises.' + liftIds[i]) })}
                    className="w-full text-left"
                  >
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-body font-medium">{t('exercises.' + liftIds[i])}</span>
                      <span className={`text-[11.5px] shrink-0 text-ink/40`}>
                        {selectedDay === 'C' ? t('program.madcow.dayCLabel') : t('program.madcow.rampLabel', { sets: ex.sets })}
                      </span>
                    </div>
                    <RampBars ex={ex} day={selectedDay} />
                  </button>
                </div>
              ))}
            </div>

            <div className={cardClass}>
              <button
                onClick={() => setHowOpen(v => !v)}
                aria-expanded={howOpen}
                className={`w-full flex items-center justify-between font-semibold text-card ${howOpen ? 'text-accent-300' : ''}`}
              >
                {t('program.madcow.howTitle')}
                {howOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
              </button>
              {howOpen && (
                <div className="mt-4 space-y-3">
                  {t('program.madcow.howSteps', { returnObjects: true }).map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-[22px] h-[22px] shrink-0 rounded-full border border-accent/50 text-accent-300 text-tab font-semibold flex items-center justify-center tabular-nums">{i + 1}</span>
                      <p className={`text-[13px] leading-[1.5] text-ink/70`}>{step}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        );
      })() : (() => {
        const exercises = prog.dayExercises(selectedWorkout, programState);
        const volume = computeProjectedVolume(exercises).toLocaleString();
        return (
          <>
            <Segmented variant="medium" value={selectedWorkout} onChange={setSelectedWorkout} options={prog.days.map(w => ({ val: w, label: t(`workout.type${w}`) }))} />
            <div className={cardClass}>
              <div className="flex justify-between items-center mb-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold text-[16px] truncate">{t(`workout.type${selectedWorkout}`)}</p>
                  <Badge>{t('program.standard.badge')}</Badge>
                </div>
                <span className={`text-[12.5px] shrink-0 ${mutedClass}`}>{t('program.standard.kgLifted', { value: volume })}</span>
              </div>
              <p className={`text-body leading-relaxed mb-1 ${mutedClass}`}>{t('program.standard.note')}</p>
              {selectedWorkout === 'B' && (
                <p className={`text-body leading-relaxed mb-1 ${mutedClass}`}>{t('program.standard.deadliftNote')}</p>
              )}
              <p className={`text-meta leading-relaxed mb-4 ${mutedClass}`}>{t('technique.hint')}</p>
              {exercises.map((ex, i) => {
                const target = targetReps(ex);
                const wentUp = wentUpLastTime(history, ex.id, ex.weight);
                const synthetic = { setWeights: new Array(ex.sets).fill(ex.weight), setReps: new Array(ex.sets).fill(target) };
                return (
                  <div key={ex.id} className={i > 0 ? `mt-4 pt-4 rule-fade-top` : ''}>
                    <button
                      onClick={() => onOpenGuide(ex.id)}
                      aria-label={t('technique.openAria', { exercise: t('exercises.' + ex.id) })}
                      className="w-full text-left"
                    >
                      <div className="flex justify-between items-baseline gap-3">
                        <span className="text-body font-medium">{t('exercises.' + ex.id)}</span>
                        <span className={`text-[11.5px] shrink-0 text-ink/40`}>
                          {t('program.standard.setsRepsShort', { sets: ex.sets, reps: target })}
                          {wentUp ? ` · ${t('program.standard.wentUpLastTime')}` : ''}
                        </span>
                      </div>
                      <RampBars ex={synthetic} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className={cardClass}>
              <p className="font-semibold text-[16px] mb-4">{t('program.standard.progressionTitle')}</p>
              {[
                ['allReps', 'allRepsValue'],
                ['missedReps', 'missedRepsValue'],
                ['threeMisses', 'threeMissesValue'],
              ].map(([labelKey, valueKey], i) => (
                <div key={labelKey} className={`flex justify-between items-center gap-3 py-3 ${i > 0 ? ('rule-fade') : ''}`}>
                  <span className={`text-body ${mutedClass}`}>{t('program.standard.' + labelKey)}</span>
                  <span className="text-body text-right">{t('program.standard.' + valueKey)}</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      <Kicker>{t('program.kickerAdjust')}</Kicker>

      {isMadcow ? (
        <>
          <div className={cardClass}>
            <p className="font-semibold text-card mb-1">{t('program.madcow.secondPress')}</p>
            <p className={`text-[13px] leading-relaxed mb-4 ${mutedClass}`}>{t('program.madcow.secondPressNote')}</p>
            <Segmented
              variant="medium"
              value={mcPress}
              onChange={onChangeMcPress}
              options={MADCOW_PRESS_OPTIONS.map(id => ({ val: id, label: t('exercises.' + id) }))}
            />
          </div>

          <div className={cardClass}>
            <p className="font-semibold text-card mb-1">{t('program.madcow.topSets')}</p>
            <p className={`text-[13px] leading-relaxed mb-4 ${mutedClass}`}>{t('program.madcow.topSetsNote')}</p>
            {programAllLiftIds('madcow', programState).map((id, i) => {
              const increment = prog.increments[id] ?? 2.5;
              const fractional = increment !== (getProgram('standard').increments[id] ?? increment) || increment < 2;
              return (
                <div key={id} className={`flex justify-between items-center gap-3 py-3 ${i > 0 ? ('rule-fade') : ''}`}>
                  <div>
                    <p className="text-[14px] font-medium">{t('exercises.' + id)}</p>
                    <p className={`text-meta ${mutedClass}`}>{t(fractional ? 'program.madcow.incrementFractional' : 'program.madcow.incrementFull', { value: increment })}</p>
                  </div>
                  <WeightInput
                    value={mcTop[id]}
                    increment={increment}
                    min={INITIAL_WEIGHTS[id] ?? 20}
                    onChange={(next) => onUpdateMcTop(id, next)}
                    label={t('exercises.' + id)}
                    variant="compact"
                    topSet
                  />
                </div>
              );
            })}
          </div>

          <div className={cardClass}>
            <p className="font-semibold text-card mb-1">{t('program.madcow.setInterval')}</p>
            <p className={`text-[13px] leading-relaxed mb-4 ${mutedClass}`}>{t('program.madcow.setIntervalNote')}</p>
            <Segmented
              variant="medium"
              value={mcInterval}
              onChange={onChangeMcInterval}
              options={MADCOW_INTERVAL_OPTIONS.map(v => ({ val: v, label: `${v}%` }))}
            />
          </div>
        </>
      ) : (
        <div className={cardClass}>
          <button
            onClick={() => setCustomiseOpen(v => !v)}
            aria-expanded={customiseOpen}
            className={`w-full flex items-center justify-between font-semibold text-card ${customiseOpen ? 'text-accent-300' : ''}`}
          >
            {t('program.standard.customise')}
            {customiseOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
          </button>
          <p className={`text-[13px] leading-relaxed mt-2 ${mutedClass}`}>{t('program.standard.customiseNote')}</p>
          {customiseOpen && (
            <div className="mt-4">
              {isWorkoutActive && (
                <p className={`text-[12.5px] leading-relaxed mb-3 ${mutedClass}`}>{t('program.standard.note')}</p>
              )}
              <ProgramEditor program={program} onChange={onChangeProgram} />
            </div>
          )}
        </div>
      )}

      {programSheet?.step === 'pick' && (
        <div role="dialog" aria-modal="true" aria-label={t('program.picker.title')} onClick={() => setProgramSheet(null)} className="fixed inset-0 z-[400] flex items-end justify-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div onClick={e => e.stopPropagation()} className={`w-full max-w-md rounded-t-sheet pt-[22px] px-5 pb-6 bg-surface`}>
            <h3 className="text-lg font-semibold mb-1">{t('program.picker.title')}</h3>
            <p className={`text-body mb-5 ${mutedClass}`}>{t('program.picker.subtitle')}</p>
            <div className="space-y-3 mb-4">
              {PROGRAM_IDS.map(id => {
                const active = id === preset;
                return (
                  <button
                    key={id}
                    onClick={() => selectProgram(id)}
                    className={`w-full text-left p-4 rounded-[10px] border transition-colors ${active ? 'border-accent bg-accent-900' : ('border-ink/12')}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-accent' : ('border-ink/30')}`}>
                        {active && <span className="w-2 h-2 rounded-full bg-accent" />}
                      </span>
                      <p className="font-semibold text-[15.5px] flex-1">{t(getProgram(id).nameKey)}</p>
                      {active && <span className="text-tab uppercase tracking-wide text-accent-300 shrink-0">{t('program.picker.active')}</span>}
                    </div>
                    <p className={`text-[13px] leading-relaxed mb-3 ${mutedClass}`}>{t(`program.picker.${id}Body`)}</p>
                    <div className="flex flex-wrap gap-2">
                      <Chip>{t('program.picker.chipFrequency')}</Chip>
                      <Chip>{t(`program.picker.chip${id === 'standard' ? 'Standard' : 'Madcow'}Days`)}</Chip>
                      <Chip>{t(`program.picker.chip${id === 'standard' ? 'Standard' : 'Madcow'}Increment`)}</Chip>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setProgramSheet(null)} className={`w-full h-[46px] flex items-center justify-center rounded-lg border text-[14px] font-medium active:scale-95 border-ink/18 text-ink`}>{t('program.picker.cancel')}</button>
          </div>
        </div>
      )}

      {programSheet?.step === 'confirm' && (() => {
        const target = programSheet.target;
        const toMadcow = target === 'madcow';
        const previewTop = toMadcow ? seedMadcowTops(weights) : mcTop;
        const pressId = mcPress === 'press' ? 'press' : 'incline';
        const rowIds = ['squat', 'bench', 'row', 'deadlift', pressId];
        // Existing users' saved `weights` predate the incline lift, so it may be
        // missing entirely -- fall back to the same bench-derived seed used to
        // build previewTop, so the "from" side is never undefined.
        const fromWeights = { ...weights, incline: weights.incline ?? seedInclineWeight(weights.bench) };
        return (
          <div role="dialog" aria-modal="true" aria-label={t(toMadcow ? 'program.confirm.toMadcowTitle' : 'program.confirm.toStandardTitle')} className="fixed inset-0 z-[450] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
            <div className={`w-full max-w-sm rounded-modal p-6 border bg-surface border-ink/8`}>
              <h3 className="text-lg font-semibold mb-3">{t(toMadcow ? 'program.confirm.toMadcowTitle' : 'program.confirm.toStandardTitle')}</h3>
              <p className={`text-card leading-relaxed mb-6 text-ink/60`}>{t(toMadcow ? 'program.confirm.toMadcowBody' : 'program.confirm.toStandardBody')}</p>
              <div className="space-y-2 mb-4 text-left">
                {rowIds.map(id => (
                  <div key={id} className={`flex justify-between items-center px-4 py-3 rounded-lg bg-surface-deep`}>
                    <span className={`text-meta uppercase ${mutedClass}`}>{t('exercises.' + id)}</span>
                    <span className="text-[14px] tabular-nums">
                      {toMadcow
                        ? t('program.confirm.topSetRow', { from: fromWeights[id], to: previewTop[id] })
                        : t('program.confirm.flatRow', { weight: previewTop[id] })}
                    </span>
                  </div>
                ))}
              </div>
              {isWorkoutActive && (
                <p className={`text-[13px] mb-6 ${mutedClass}`}>{t('program.confirm.endsWorkout')}</p>
              )}
              <button onClick={() => onSwitchProgram(target)} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 mb-3">{t('program.confirm.switch')}</button>
              <button onClick={() => setProgramSheet(null)} className={`text-card active:scale-90 ${mutedClass}`}>{t('program.confirm.cancel')}</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ProgramScreen;
