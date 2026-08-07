import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendUp, ArrowRight } from '@phosphor-icons/react';
import { formatClock, isExercisePassed, targetReps } from '../../utils';
import { MAX_SETS } from '../../constants';
import Modal from './Modal';
import { Z_TOP } from './zIndex';

// Gap between set blocks, kept in sync with the row's gap-1.5 below -- the width calc
// needs the same number to divide the row into exactly `columns` even slots.
const SET_BLOCK_GAP = 6;

const CompletionSummaryModal = ({ completionSummary, onDone }) => {
  const { t } = useTranslation();
  const totalTime = formatClock(completionSummary.workout.duration);
  return (
    <Modal ariaLabel="Workout complete" z={Z_TOP} cardClassName="max-w-sm p-6">
      <p className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-accent-300 mb-4">{t('completion.kicker')}</p>
      {totalTime && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg mb-5 bg-surface-deep">
          <span className="text-meta uppercase text-ink/62">{t('completion.totalTime')}</span>
          <span className="font-mono text-card tabular-nums">{totalTime}</span>
        </div>
      )}
      <div className="space-y-3 mb-6">
        {completionSummary.workout.exercises.map(ex => {
          const passed = isExercisePassed(ex);
          const progressed = completionSummary.progressions.includes(ex.id);
          const nextWeight = completionSummary.nextWeights?.[ex.id];
          const mutedColor = 'text-ink/62';
          const setDurations = ex.setDurations ?? [];
          const logged = setDurations.filter(d => typeof d === 'number');
          const hasSplits = logged.length > 0;
          const exerciseTime = hasSplits ? formatClock(logged.reduce((sum, d) => sum + d, 0)) : null;
          // A row of MAX_SETS (5) blocks fills the width; a lift with more sets than
          // that (Madcow Day C's 6) shrinks its blocks to fit instead of overflowing.
          const setColumns = Math.max(ex.setsCompleted.length, MAX_SETS);
          return (
            <div key={ex.id} className="p-3 rounded-lg border bg-surface-deep border-ink/14">
              <div className="flex items-center justify-between">
                <span className="text-card font-medium">{t('exercises.' + ex.id)}</span>
                {progressed ? (
                  <span className="flex items-center gap-1 text-body text-accent"><TrendUp size={14} />{t('completion.progressedTo', { from: ex.weight, to: nextWeight })}</span>
                ) : (
                  <span className={`flex items-center gap-1 text-body ${mutedColor}`}><ArrowRight size={14} />{t('completion.staysAt', { weight: ex.weight })}</span>
                )}
              </div>
              <div className="flex justify-start gap-1.5 mt-2.5">
                {ex.setsCompleted.map((r, i) => {
                  const val = r ?? 0;
                  const failed = val < targetReps(ex, i);
                  const split = formatClock(setDurations[i]);
                  return (
                    <div
                      key={i}
                      style={{ width: `calc((100% - ${SET_BLOCK_GAP * (setColumns - 1)}px) / ${setColumns})` }}
                      className="shrink-0 max-w-[3.5rem] rounded-lg py-1.5 bg-surface"
                    >
                      <div className={`font-display font-semibold text-body tabular-nums leading-none ${failed && !passed ? 'text-ink' : 'text-ink/70'}`}>{val}</div>
                      {hasSplits && <div className={`font-mono text-meta tabular-nums leading-none mt-1 ${mutedColor}`}>{split ?? '–'}</div>}
                    </div>
                  );
                })}
              </div>
              {exerciseTime && <p className={`font-mono text-meta tabular-nums mt-2 ${mutedColor}`}>{t('completion.exerciseTime', { time: exerciseTime })}</p>}
            </div>
          );
        })}
      </div>
      <button onClick={onDone} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent-300 font-medium text-[14.5px] active:scale-95">{t('completion.done')}</button>
    </Modal>
  );
};

export default CompletionSummaryModal;
