import React from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown, Play, Info } from '@phosphor-icons/react';
import { INITIAL_WEIGHTS } from '../constants';
import { getProgram, topWeightOf } from '../programs';
import WeightInput from '../components/WeightInput';
import BarSetupDiagram from '../components/BarSetupDiagram';
import ExerciseCard from '../components/ExerciseCard';

const TrainScreen = ({
  isWorkoutActive, preset, getCurrentDay, program, weights, mcTop, mcInterval, mcPress, mcWeek, moodLabel,
  expandedBarSetup, setExpandedBarSetup, setWorkoutPicker, updateMcTop, handleUpdateIdleWeight, setGuideLift,
  startWorkout, trainedToday, workoutStats,
  currentWorkout, handleToggleSet, handleOpenRepPicker, handleUpdateActiveWeight, handleUpdateActiveSetWeight,
  finishWorkout, setShowCancelModal,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {!isWorkoutActive ? (
        <div>
          {(() => {
            const prog = getProgram(preset);
            const isMadcow = prog.ramped;
            const day = getCurrentDay(prog.id);
            const programState = { program, weights, mcTop, mcInterval, mcPress };
            const liftIds = prog.liftIds(day, programState);
            const dayExercises = prog.dayExercises(day, programState);
            return (
              <>
                <div className="mb-4">
                  <p className="text-kicker font-semibold uppercase tracking-[0.14em] text-accent mb-1">{isMadcow ? t('workout.madcowKicker', { week: mcWeek }) : t('workout.standardKicker')}</p>
                  <div className="flex items-center gap-[10px]">
                    <h2 className="text-hero font-medium leading-tight">{t(`workout.type${day}`)}</h2>
                    <button
                      onClick={() => setWorkoutPicker(true)}
                      aria-label={t('workout.chooseWorkoutAria')}
                      className="w-[38px] h-[38px] rounded-lg border flex items-center justify-center shrink-0 border-ink/18 text-ink"
                    ><CaretDown size={16} /></button>
                  </div>
                  <p className="text-body mt-1 text-ink/45">
                    {isMadcow
                      ? t('workout.madcowSubtitle', { mood: moodLabel(day), lifts: liftIds.map(id => t('exercises.' + id)).join(' · ') })
                      : liftIds.map(id => t('exercises.' + id)).join(' · ')}
                  </p>
                </div>
                <div className="mb-8">{dayExercises.map((ex, i) => {
                  const liftId = liftIds[i];
                  const exName = t('exercises.' + liftId);
                  const isBarSetupOpen = !!expandedBarSetup[liftId];
                  const topWeight = topWeightOf(ex);
                  return (
                  <div key={liftId} className="py-[15px] rule-fade">
                    <div className={`flex justify-between ${isMadcow ? 'items-start' : 'items-center'}`}>
                      <button
                        onClick={() => setExpandedBarSetup(prev => ({ ...prev, [liftId]: !prev[liftId] }))}
                        aria-expanded={isBarSetupOpen}
                        className="flex flex-col items-start min-h-[44px] text-left flex-1 min-w-0 pr-3"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-[16px] font-medium truncate">{exName}</p>
                          <CaretDown size={12} weight="bold" className={`shrink-0 opacity-35 transition-transform ${isBarSetupOpen ? 'rotate-180' : ''}`} />
                        </div>
                        <p className="text-[12.5px] text-ink/45">
                          {isMadcow ? (day === 'C' ? t('workout.dayCMeta') : t('workout.rampSetsMeta', { sets: ex.sets, from: Math.min(...ex.setWeights), to: topWeight })) : `${ex.sets} × ${ex.reps}`}
                        </p>
                      </button>
                      <WeightInput
                        value={isMadcow ? mcTop[liftId] : weights[liftId]}
                        increment={ex.increment}
                        min={isMadcow ? (INITIAL_WEIGHTS[liftId] ?? 20) : 20}
                        onChange={(next) => isMadcow ? updateMcTop(liftId, next) : handleUpdateIdleWeight(liftId, next)}
                        label={exName}
                        variant="prominent"
                        topSet={isMadcow}
                        caption={isMadcow ? t('workout.topSetFieldLabel') : undefined}
                      />
                    </div>
                    {isBarSetupOpen && (
                      <div className="mt-3 rounded-[9px] p-3.5 bg-surface/70">
                        <BarSetupDiagram weight={topWeight} />
                        <button
                          onClick={() => setGuideLift(liftId)}
                          aria-label={t('technique.openAria', { exercise: exName })}
                          className="flex items-center gap-1 min-h-9 mt-3 text-[12.5px] font-medium text-accent-300"
                        ><Info size={13} /> {t('technique.open')}</button>
                      </div>
                    )}
                  </div>
                  );
                })}</div>
              </>
            );
          })()}
          <button onClick={() => startWorkout()} disabled={trainedToday} className={`w-full h-[54px] rounded-lg border border-accent text-accent font-medium text-[16px] flex items-center justify-center gap-2 transition-opacity ${trainedToday ? 'opacity-35' : 'active:scale-[0.98]'}`}><Play size={18} weight="fill" /> {trainedToday ? t('workout.trainedToday') : t('workout.startWorkout')}</button>
          <p className="text-meta text-center mt-3 text-ink/38">{trainedToday ? t('workout.alreadyTrained') : t('workout.weekProgress', { count: workoutStats.thisWeek })}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-center mb-2"><h2 className="text-kicker font-semibold uppercase tracking-[0.14em] text-ink/45">{currentWorkout ? t(`workout.type${currentWorkout.type}`) : ''}</h2></div>
          {(() => {
            const anySetLogged = currentWorkout?.exercises.some(ex => ex.setsCompleted.some(s => s !== null));
            return currentWorkout?.exercises.map((ex, exIdx) => (
              <ExerciseCard
                key={ex.id}
                ex={ex}
                exIdx={exIdx}
                onToggleSet={handleToggleSet}
                onOpenRepPicker={handleOpenRepPicker}
                showHint={exIdx === 0 && !anySetLogged}
                onWeightChange={(next) => handleUpdateActiveWeight(exIdx, next)}
                setWeightMin={INITIAL_WEIGHTS[ex.id] ?? 20}
                onSetWeightChange={(setIdx, next) => handleUpdateActiveSetWeight(exIdx, setIdx, next)}
                onOpenGuide={() => setGuideLift(ex.id)}
              />
            ));
          })()}
          <div className="pt-4 flex flex-col items-center">
            {(() => {
              const allDone = currentWorkout?.exercises.every(ex => ex.setsCompleted.every(s => s !== null));
              return (
                <>
                  <button onClick={finishWorkout} disabled={!allDone} className={`w-full h-[52px] rounded-lg border font-medium text-[15.5px] ${allDone ? 'border-accent text-accent active:scale-[0.98]' : 'border-ink/12 text-ink/30'}`}>{t('workout.finishWorkout')}</button>
                  {!allDone && <p className="text-meta text-center mt-3 text-ink/45">{t('workout.completeAllSets')}</p>}
                </>
              );
            })()}
            <button onClick={() => setShowCancelModal(true)} className="mt-8 w-full min-h-[44px] flex items-center justify-center text-card text-ink/45">{t('workout.discardWorkout')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainScreen;
