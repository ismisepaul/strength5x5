import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash, X } from '@phosphor-icons/react';
import { targetReps } from '../../utils';
import { evaluateWorkoutOutcome } from '../../progression';
import { getProgram, topWeightOf } from '../../programs';
import WeightInput from '../WeightInput';
import Sheet from './Sheet';
import { Z_EDIT_ENTRY } from './zIndex';

// The Log's add/edit-entry sheet -- carries more logic than the other modals
// (date-conflict/future-date validation, progression-on-save, delete confirm)
// because editing a logged session is where those all meet. showDeleteConfirm is
// local since nothing outside this modal reads or writes it.
const EditEntryModal = ({
  editingEntry, setEditingEntry, history, historyDateSet, preset, currentWorkoutType,
  weights, program, mcTop, mcInterval, mcPress,
  setWeights, setCurrentWorkoutType, setHistory, showToast, handleManualLogSave, saveToDriveQuietly, getAppState,
}) => {
  const { t } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isNewEntry = editingEntry.index === -1;
  const entryProg = getProgram(editingEntry.session.preset);
  // A logged entry always belongs to whatever program is active -- its exercises,
  // customisation (e.g. Madcow's second-press choice) and increments all come from
  // there, so the Log stays consistent with the Program tab. To log a session for
  // the other program, switch to it first.
  const rebuildEntryFor = (day) => {
    const exercises = entryProg.dayExercises(day, { program, weights, mcTop, mcInterval, mcPress })
      .map(ex => ({ ...ex, setsCompleted: Array.from({ length: ex.sets }, (_, i) => targetReps(ex, i)) }));
    return { type: day, preset: entryProg.id, exercises };
  };
  const selectedDate = editingEntry.session.date.slice(0, 10);
  const originalDate = !isNewEntry ? history[editingEntry.index]?.date.slice(0, 10) : null;
  const dateConflict = selectedDate !== originalDate && historyDateSet.has(selectedDate);
  const isFutureDate = selectedDate > new Date().toISOString().slice(0, 10);

  const handleClose = () => { setEditingEntry(null); setShowDeleteConfirm(false); };

  return (
    <Sheet ariaLabel={isNewEntry ? 'Add workout' : 'Edit workout'} z={Z_EDIT_ENTRY} onClose={handleClose}>
    <div className="max-h-[75vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">{isNewEntry ? t('modals.addWorkout') : t('modals.editWorkout')}</h3>
        <button onClick={handleClose} aria-label="Close edit modal" className="w-10 h-10 rounded-lg border flex items-center justify-center border-ink/15 text-ink"><X size={18} /></button>
      </div>

      {isNewEntry && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-meta uppercase tracking-[0.12em] text-ink/62">{t('modals.workoutType')}</label>
            <span className="text-meta text-ink/62">{t(entryProg.nameKey)}</span>
          </div>
          <div className="flex gap-2">
            {entryProg.days.map(wt => (
              <button
                key={wt}
                onClick={() => setEditingEntry(prev => ({ ...prev, session: { ...prev.session, ...rebuildEntryFor(wt) } }))}
                className={`flex-1 py-3 rounded-lg text-card font-medium transition-all border ${editingEntry.session.type === wt ? 'border-accent text-accent bg-accent-900' : 'border-ink/26 text-ink/60'}`}
              >{t(`workout.type${wt}`)}</button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <label className="text-meta uppercase tracking-[0.12em] block mb-2 text-ink/62">{t('modals.date')}</label>
        <input
          type="date"
          value={editingEntry.session.date.slice(0, 10)}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => {
            const newDate = new Date(e.target.value);
            newDate.setHours(12, 0, 0, 0);
            setEditingEntry(prev => ({ ...prev, session: { ...prev.session, date: newDate.toISOString() } }));
          }}
          className={`w-full p-3 rounded-lg text-card border ${dateConflict || isFutureDate ? 'border-dashed border-ink/50' : 'border-ink/26'} bg-surface-deep text-ink`}
        />
        {dateConflict && <p className="text-body mt-2 text-ink/60">{t('modals.dateConflict')}</p>}
        {isFutureDate && <p className="text-body mt-2 text-ink/60">{t('modals.futureDate')}</p>}
      </div>

      <div className="space-y-3 mb-6">
        {editingEntry.session.exercises.map((ex, exIdx) => (
          <div key={ex.id} className="p-4 rounded-lg border bg-surface-deep border-ink/14">
            <p className="text-body font-medium mb-3">{t('exercises.' + ex.id)}</p>
            <div className="flex justify-between items-center mb-3">
              <span className="text-meta uppercase text-ink/62">{t('modals.weightLabel')}</span>
              {entryProg.ramped ? (
                <span className="text-card tabular-nums text-accent-300">{topWeightOf(ex)}kg</span>
              ) : (
                <WeightInput
                  value={ex.weight}
                  increment={entryProg.increments[ex.id] ?? 2.5}
                  min={20}
                  onChange={(next) => setEditingEntry(prev => {
                    const s = JSON.parse(JSON.stringify(prev.session));
                    s.exercises[exIdx].weight = next;
                    return { ...prev, session: s };
                  })}
                  label={t('exercises.' + ex.id)}
                  variant="compact"
                />
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-meta uppercase text-ink/62">{t('modals.setsLabel')}</span>
              <div className="flex gap-2">
                {ex.setsCompleted.map((reps, setIdx) => {
                  const target = targetReps(ex, setIdx);
                  const stateClass = reps === null
                    ? 'border border-ink/26 text-ink/40'
                    : reps === target
                      ? 'border border-accent bg-accent-900 text-accent-300'
                      : 'border border-dashed border-ink/50 bg-neutral-tint text-ink';
                  return (
                    <button
                      key={setIdx}
                      onClick={() => setEditingEntry(prev => {
                        const s = JSON.parse(JSON.stringify(prev.session));
                        const cur = s.exercises[exIdx].setsCompleted[setIdx];
                        s.exercises[exIdx].setsCompleted[setIdx] = cur === null ? target : cur === 0 ? null : cur - 1;
                        return { ...prev, session: s };
                      })}
                      aria-label={`Set ${setIdx + 1}: ${reps === null ? 'not done' : reps + ' reps'}`}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-body font-medium active:scale-90 transition-transform ${stateClass}`}
                    >
                      {reps === null ? '–' : reps}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        disabled={dateConflict || isFutureDate}
        onClick={() => {
          const unsortedHistory = isNewEntry
            ? [...history, editingEntry.session]
            : history.map((s, i) => i === editingEntry.index ? editingEntry.session : s);
          const newHistory = [...unsortedHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
          const savedIndex = newHistory.findIndex(s => s === editingEntry.session);
          const isLatestEntry = savedIndex === 0;
          // Progression only runs for a Standard entry that's both the newest session
          // and the program you're actually on -- a Madcow entry never bumps mcTop/mcWeek
          // here, since those advance on the weekly rollover and a manually logged (or
          // backdated) session would otherwise double-advance them.
          const shouldProgress = isLatestEntry && entryProg.id === 'standard' && preset === 'standard';

          let nextWeights = weights;
          let nextType = currentWorkoutType;

          if (shouldProgress) {
            const priorHistory = newHistory.slice(1);
            const { nextWeights: adjustedWeights } = evaluateWorkoutOutcome(editingEntry.session, priorHistory, weights);
            nextWeights = adjustedWeights;
            nextType = editingEntry.session.type === 'A' ? 'B' : 'A';

            setWeights(adjustedWeights);
            setCurrentWorkoutType(nextType);
          }

          setHistory(newHistory);
          showToast(t(isNewEntry ? 'toast.workoutAdded' : 'toast.workoutUpdated'), 'success');
          setEditingEntry(null);
          handleManualLogSave({ history: newHistory, weights: nextWeights, nextType });
        }}
        className={`w-full h-12 flex items-center justify-center rounded-lg border text-[14.5px] font-medium mb-6 ${dateConflict || isFutureDate ? 'border-ink/12 text-ink/30' : 'border-accent text-accent active:scale-95'}`}
      >{isNewEntry ? t('modals.addWorkout') : t('modals.saveChanges')}</button>

      {!isNewEntry && (
        !showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 text-card active:scale-90 text-ink/62"
          ><Trash size={14} /> {t('modals.deleteWorkout')}</button>
        ) : (
          <div className="p-4 rounded-lg border border-dashed border-ink/30">
            <p className="text-body text-center mb-3">{t('modals.deleteConfirm')}</p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  const newHistory = history.filter((_, idx) => idx !== editingEntry.index);
                  setHistory(newHistory);
                  setEditingEntry(null);
                  setShowDeleteConfirm(false);
                  showToast(t('toast.workoutDeleted'), 'success');
                  saveToDriveQuietly({ ...getAppState(), history: newHistory });
                }}
                className="flex-1 h-[46px] flex items-center justify-center rounded-lg border text-[14px] font-medium active:scale-95 border-ink/26 text-ink"
              >{t('modals.delete')}</button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-[46px] flex items-center justify-center text-[14px] active:scale-95 text-ink/62"
              >{t('modals.cancel')}</button>
            </div>
          </div>
        )
      )}
    </div>
    </Sheet>
  );
};

export default EditEntryModal;
