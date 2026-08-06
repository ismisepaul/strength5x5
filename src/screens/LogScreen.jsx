import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CaretDown, CaretRight, PencilSimple } from '@phosphor-icons/react';
import { formatDuration, targetReps } from '../utils';
import { getProgram } from '../programs';
import { getWorkoutStats, groupHistory, sessionTonnage } from '../utils/chartData';
import Segmented from '../components/Segmented';

// A session's day+date sits in a fixed left column, program/workout/meta in the middle,
// and the outcome (all reps, or a dashed miss chip -- shape, not hue) on the right.
// Tapping the row expands it in place, showing each exercise's sets as the same
// set-target rectangles Train uses, with Edit on the right where a thumb lands.
const LogEntry = ({ session: s, isExpanded, onToggle, onEdit, mutedClass, t }) => {
  const date = new Date(s.date);
  const missCount = s.exercises.reduce((n, ex) => n + ex.setsCompleted.filter((r, i) => r !== targetReps(ex, i)).length, 0);
  const tonnage = Math.round(sessionTonnage(s));

  return (
    <div>
      <button onClick={onToggle} aria-expanded={isExpanded} className="w-full text-left p-4 rounded-[10px] border active:scale-[0.98] transition-transform bg-surface border-ink/14 flex gap-3 items-start">
        <div className="flex flex-col items-center w-10 shrink-0 pt-0.5">
          <span className={`text-tab uppercase tracking-wide ${mutedClass}`}>{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
          <span className="text-card font-semibold tabular-nums">{date.getDate()}</span>
          <span className={`text-tab uppercase tracking-wide ${mutedClass}`}>{date.toLocaleDateString(undefined, { month: 'short' })}</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-kicker font-semibold uppercase tracking-[0.14em] text-accent-300">{t(getProgram(s.preset).nameKey)}</span>
          <p className="text-card font-semibold mt-0.5">{t(`workout.type${s.type}`)}</p>
          <p className={`text-meta mt-0.5 ${mutedClass}`}>{s.duration ? `${formatDuration(s.duration, t)} · ` : ''}{tonnage.toLocaleString()} {t('log.tonnage')}</p>
        </div>
        <div className="shrink-0 pt-0.5">
          {missCount === 0 ? (
            <span className={`text-meta whitespace-nowrap ${mutedClass}`}>{t('log.allReps')}</span>
          ) : (
            <span className="text-meta whitespace-nowrap px-2 py-1 rounded-md border border-dashed border-ink/40 text-ink/62">{t('log.miss', { count: missCount })}</span>
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="mt-2 p-4 rounded-[10px] border bg-surface-deep border-ink/14 space-y-3">
          {s.exercises.map(ex => (
            <div key={ex.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-meta ${mutedClass}`}>{t('exercises.' + ex.id)}</span>
                <span className="text-meta tabular-nums text-accent-300">{ex.weight}kg</span>
              </div>
              <div className="flex gap-1.5">
                {ex.setsCompleted.map((r, ri) => {
                  const target = targetReps(ex, ri);
                  const passed = r !== null && r === target;
                  const missed = r !== null && r !== target;
                  const stateClass = passed
                    ? 'border border-accent bg-accent-900 text-accent-300'
                    : missed
                      ? 'border border-dashed border-ink/50 bg-neutral-tint text-ink'
                      : 'border border-ink/26 text-ink/40';
                  return (
                    <div key={ri} className={`flex-1 aspect-[1.35] rounded-[10px] flex items-center justify-center ${stateClass}`}>
                      <span className="text-[13px] font-semibold">{r !== null ? r : target}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
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
  history, preset, program, weights, mcTop, mcInterval, mcPress, getCurrentDay, setEditingEntry,
  logGrouping, setLogGrouping, expandedGroups, setExpandedGroups, expandedLogEntry, setExpandedLogEntry,
}) => {
  const { t } = useTranslation();
  const mutedClass = 'text-ink/62';
  const renderEntry = (s, key, onEdit) => (
    <LogEntry
      key={key}
      session={s}
      isExpanded={expandedLogEntry === key}
      onToggle={() => setExpandedLogEntry(prev => prev === key ? null : key)}
      onEdit={onEdit}
      mutedClass={mutedClass}
      t={t}
    />
  );
  const stats = getWorkoutStats(history);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-title font-medium">{t('log.title')}</h2>
        <button
          onClick={() => {
            // Defaults to whatever program/day you're actually on -- the modal lets
            // you pick a different program and day before saving.
            const prog = getProgram(preset);
            const day = getCurrentDay(prog.id);
            const exercises = prog.dayExercises(day, { program, weights, mcTop, mcInterval, mcPress })
              .map(ex => ({ ...ex, setsCompleted: Array.from({ length: ex.sets }, (_, i) => targetReps(ex, i)) }));
            setEditingEntry({ index: -1, session: { date: new Date().toISOString(), type: day, preset: prog.id, exercises } });
          }}
          aria-label="Add workout"
          className="w-10 h-10 rounded-lg border flex items-center justify-center active:scale-90 transition-transform border-ink/26 text-ink"
        ><Plus size={18} /></button>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className={i < stats.thisWeek ? 'w-2 h-2 rounded-full bg-accent' : 'w-2 h-2 rounded-full border border-ink/30'} />
          ))}
        </div>
        <span className={`text-body ${mutedClass}`}>{stats.thisWeek >= 3 ? t('log.weekDone') : t('log.toGo', { count: 3 - stats.thisWeek })}</span>
        <span className={mutedClass}>·</span>
        <span className={`text-body ${mutedClass}`}>{t('header.streak', { count: stats.streak })}</span>
        <span className={mutedClass}>·</span>
        <span className={`text-body ${mutedClass}`}>{stats.total} {t('log.total')}</span>
      </div>

      {history.length > 0 && (
        <Segmented
          options={[{ label: t('log.all'), val: 'all' }, { label: t('log.week'), val: 'week' }, { label: t('log.month'), val: 'month' }, { label: t('log.year'), val: 'year' }]}
          value={logGrouping}
          onChange={(val) => {
            setLogGrouping(val);
            setExpandedLogEntry(null);
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
        <p className={`py-20 text-center ${mutedClass}`}>{t('log.noHistory')}</p>
      ) : logGrouping === 'all' ? (
        history.map((s, i) => renderEntry(s, i, () => setEditingEntry({ index: i, session: JSON.parse(JSON.stringify(s)) })))
      ) : (
        groupHistory(history, logGrouping, 0).map((group) => (
          <div key={group.key}>
            <button
              onClick={() => setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
              aria-label={`Toggle ${group.key}`}
              className="w-full flex items-center justify-between px-4 py-3 rounded-[10px] border transition-all active:scale-[0.99] bg-surface border-ink/14"
            >
              <div className="flex items-center gap-3">
                {expandedGroups[group.key] ? <CaretDown size={18} className={mutedClass} /> : <CaretRight size={18} className={mutedClass} />}
                <span className="text-card font-medium">{group.key}</span>
              </div>
              <span className="text-body px-2.5 py-1 rounded-lg bg-surface-deep text-ink/60">{group.entries.length}</span>
            </button>
            {expandedGroups[group.key] && (
              <div className="space-y-3 mt-3 ml-2">
                {group.entries.map(({ session: s, originalIndex }) => renderEntry(s, originalIndex, () => setEditingEntry({ index: originalIndex, session: JSON.parse(JSON.stringify(s)) })))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default LogScreen;
