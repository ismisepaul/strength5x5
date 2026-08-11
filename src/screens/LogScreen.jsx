import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CaretDown, CaretRight, PencilSimple, Trash, Flame } from '@phosphor-icons/react';
import { formatDuration, targetReps } from '../utils';
import { MAX_SETS } from '../constants';
import { getProgram } from '../programs';
import { getWorkoutStats, getRemainingSessionLiftIds, groupHistory, sessionTonnage, monthlySessionCounts } from '../utils/chartData';
import Segmented from '../components/Segmented';
import WeekProgressCard from '../components/WeekProgressCard';

// A session's day+date sits in a fixed left column, program/workout/meta in the middle,
// and the outcome (all reps, or a dashed miss chip -- shape, not hue) on the right.
// Tapping the row expands it in place, showing each exercise's sets as the same
// set-target rectangles Train uses, with Edit on the right where a thumb lands.
const LogEntry = ({ session: s, isExpanded, onToggle, onEdit, onDelete, mutedClass, t }) => {
  const date = new Date(s.date);
  const missCount = s.exercises.reduce((n, ex) => n + ex.setsCompleted.filter((r, i) => r !== null && r < targetReps(ex, i)).length, 0);
  const tonnage = Math.round(sessionTonnage(s));

  return (
    <div>
      <button onClick={onToggle} aria-expanded={isExpanded} className="w-full text-left p-4 rounded-[10px] border active:scale-[0.98] transition-transform bg-surface border-ink/14 flex gap-3 items-start">
        <div className="flex flex-col items-center w-10 shrink-0 pt-0.5">
          <span className={`text-[12.5px] ${mutedClass}`}>{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
          <span className="font-mono text-card font-bold tabular-nums">{date.getDate()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-accent-300">{t(getProgram(s.preset).nameKey)}</span>
          <p className="font-display font-semibold tracking-[-0.025em] text-card mt-0.5">{t(`workout.type${s.type}`)}</p>
          <p className={`text-meta mt-0.5 ${mutedClass}`}>{s.duration ? `${formatDuration(s.duration, t)} · ` : ''}<span className="font-mono">{tonnage.toLocaleString()} {t('log.tonnage')}</span></p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {missCount === 0 ? (
            <span className={`text-meta whitespace-nowrap ${mutedClass}`}>{t('log.allReps')}</span>
          ) : (
            <span className="text-meta whitespace-nowrap px-2 py-1 rounded-md border border-dashed border-ink/40 text-ink/62">{t('log.miss', { count: missCount })}</span>
          )}
          {isExpanded ? <CaretDown size={17} className={mutedClass} /> : <CaretRight size={17} className={mutedClass} />}
        </div>
      </button>
      {isExpanded && (
        <div className="mt-2 p-4 rounded-[10px] border bg-surface-deep border-ink/14 space-y-3">
          {s.exercises.map(ex => (
            <div key={ex.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-meta ${mutedClass}`}>{t('exercises.' + ex.id)}</span>
                <span className="font-display font-semibold text-meta tabular-nums text-accent-300">{ex.weight}kg</span>
              </div>
              <div className="flex gap-1.5">
                {ex.setsCompleted.map((r, ri) => {
                  const target = targetReps(ex, ri);
                  const passed = r !== null && r === target;
                  const missed = r !== null && r < target;
                  const stateClass = passed
                    ? 'border-2 border-accent bg-accent text-ground shadow-[0_0_0_3px_var(--color-accent-900)]'
                    : missed
                      ? 'border-2 border-dashed border-ink/50 bg-neutral-tint text-ink'
                      : 'border-2 border-ink/42 bg-ink/7 text-ink/85';
                  return (
                    <div
                      key={ri}
                      style={{ width: `calc((100% - ${6 * (MAX_SETS - 1)}px) / ${MAX_SETS})` }}
                      className={`aspect-[1.35] rounded-[10px] flex items-center justify-center ${stateClass}`}
                    >
                      <span className="font-display text-[13px] font-semibold tabular-nums">{r !== null ? r : target}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 h-10 px-4 rounded-lg border border-ink/26 text-ink text-body active:scale-95"
            ><Trash size={15} /> {t('modals.deleteWorkout')}</button>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 h-10 px-4 rounded-lg border border-ink/26 text-ink text-body active:scale-95"
            ><PencilSimple size={15} /> {t('modals.editWorkout')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

const LogScreen = ({
  history, preset, program, weights, mcTop, mcInterval, mcPress, getCurrentDay, setEditingEntry, setDeletingEntry,
  logGrouping, setLogGrouping, expandedGroups, setExpandedGroups, expandedLogEntry, setExpandedLogEntry,
}) => {
  const { t } = useTranslation();
  const mutedClass = 'text-ink/62';
  const renderEntry = (s, key, originalIndex) => (
    <LogEntry
      key={key}
      session={s}
      isExpanded={expandedLogEntry === key}
      onToggle={() => setExpandedLogEntry(prev => prev === key ? null : key)}
      onEdit={() => setEditingEntry({ index: originalIndex, session: JSON.parse(JSON.stringify(s)) })}
      onDelete={() => setDeletingEntry({ index: originalIndex, session: s })}
      mutedClass={mutedClass}
      t={t}
    />
  );
  const stats = getWorkoutStats(history);
  const prog = getProgram(preset);
  const remainingSessionLiftIds = getRemainingSessionLiftIds(
    history, preset, getCurrentDay(prog.id), { program, weights, mcTop, mcInterval, mcPress },
  );

  // Defaults to whatever program/day you're actually on -- the modal lets
  // you pick a different program and day before saving.
  const handleAddWorkout = () => {
    const day = getCurrentDay(prog.id);
    const exercises = prog.dayExercises(day, { program, weights, mcTop, mcInterval, mcPress })
      .map(ex => ({ ...ex, setsCompleted: Array.from({ length: ex.sets }, (_, i) => targetReps(ex, i)) }));
    setEditingEntry({ index: -1, session: { date: new Date().toISOString(), type: day, preset: prog.id, exercises } });
  };

  const addWorkoutButton = (
    <button
      onClick={handleAddWorkout}
      aria-label={t('modals.addWorkout')}
      className="h-10 px-3.5 rounded-lg border border-accent text-accent-300 text-[13.5px] font-medium flex items-center gap-1.5 active:scale-95 transition-transform"
    ><Plus size={16} /> {t('modals.addWorkout')}</button>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-1">
        <h2 className="font-display text-title font-semibold tracking-[-0.025em]">{t('log.title')}</h2>
        {addWorkoutButton}
      </div>
      <div className={`flex items-center gap-2 mb-2 text-meta ${mutedClass}`}>
        <Flame size={13} weight="fill" className="text-accent shrink-0" />
        <span>{t('header.streak', { count: stats.streak })}</span>
        <span aria-hidden="true">·</span>
        <span>{t('log.sessionCount', { count: stats.total })}</span>
      </div>
      <WeekProgressCard history={history} remainingSessionLiftIds={remainingSessionLiftIds} ramped={prog.ramped} increments={prog.increments} />

      {history.length > 0 && (
        <Segmented
          options={[{ label: t('log.all'), val: 'all' }, { label: t('log.week'), val: 'week' }, { label: t('log.month'), val: 'month' }, { label: t('log.year'), val: 'year' }]}
          value={logGrouping}
          onChange={(val) => {
            setLogGrouping(val);
            setExpandedLogEntry(null);
            // Every grouped view opens its first (most recent) band by default --
            // a collapsed Month band with nothing but a header row reads as blank.
            if (val !== 'all') {
              const groups = groupHistory(history, val, 0);
              setExpandedGroups(groups.length > 0 ? { [groups[0].key]: true } : {});
            } else {
              setExpandedGroups({});
            }
          }}
        />
      )}

      {history.length === 0 ? (
        <div className="py-20 text-center">
          <p className={`mb-4 ${mutedClass}`}>{t('log.noHistory')}</p>
          <div className="flex justify-center">{addWorkoutButton}</div>
        </div>
      ) : logGrouping === 'all' ? (
        history.map((s, i) => renderEntry(s, i, i))
      ) : (
        groupHistory(history, logGrouping, 0).map((group) => {
          const groupTonnage = Math.round(group.entries.reduce((sum, { session: s }) => sum + sessionTonnage(s), 0));
          return (
          <div key={group.key}>
            <button
              onClick={() => setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
              aria-label={`Toggle ${group.key}`}
              className="w-full flex items-center justify-between px-1 py-2.5 active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2.5">
                {expandedGroups[group.key] ? <CaretDown size={16} className={mutedClass} /> : <CaretRight size={16} className={mutedClass} />}
                <span className="text-[13.5px] font-semibold">{group.key}</span>
              </div>
              <span className={`text-meta whitespace-nowrap ${mutedClass}`}>{t('log.sessionCount', { count: group.entries.length })} · {(groupTonnage / 1000).toFixed(1)} t</span>
            </button>
            {logGrouping === 'year' && (
              <div className="flex items-end gap-[5px] px-1 mt-2">
                {monthlySessionCounts(group.entries.map(({ session: s }) => s)).map((count, m) => (
                  <div key={m} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      role="img"
                      aria-label={`${new Date(2000, m, 1).toLocaleDateString(undefined, { month: 'long' })}: ${t('log.sessionCount', { count })}`}
                      style={{ height: `${7 + count * 5}px` }}
                      className={`w-full rounded-t-[3px] ${count > 0 ? 'border border-accent bg-accent-900' : 'border border-ink/26'}`}
                    />
                    <span className={`text-[10px] ${mutedClass}`}>{new Date(2000, m, 1).toLocaleDateString(undefined, { month: 'narrow' })}</span>
                  </div>
                ))}
              </div>
            )}
            {expandedGroups[group.key] && (
              <div className="space-y-3 mt-3 ml-2">
                {group.entries.map(({ session: s, originalIndex }) => renderEntry(s, originalIndex, originalIndex))}
              </div>
            )}
          </div>
          );
        })
      )}
    </div>
  );
};

export default LogScreen;
