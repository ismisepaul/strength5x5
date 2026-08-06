import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CaretDown, CaretRight } from '@phosphor-icons/react';
import { formatDuration, targetReps } from '../utils';
import { getProgram } from '../programs';
import { getWorkoutStats, groupHistory } from '../utils/chartData';
import Segmented from '../components/Segmented';

const LogEntry = ({ session: s, onClick, mutedClass, t }) => (
  <button onClick={onClick} className="w-full text-left p-4 rounded-[10px] border active:scale-[0.98] transition-transform bg-surface border-ink/14">
    <div className="flex justify-between items-center mb-1">
      <span className="text-kicker font-semibold uppercase tracking-[0.14em] text-accent-300">{t(getProgram(s.preset).nameKey)}</span>
      <span className={`text-body ${mutedClass}`}>{s.duration ? `${formatDuration(s.duration, t)} · ` : ''}{new Date(s.date).toLocaleDateString()}</span>
    </div>
    <p className="text-card font-semibold mb-3">{t(`workout.type${s.type}`)}</p>
    <div className="space-y-2">{s.exercises.map(ex => (
      <div key={ex.id} className="flex justify-between text-card items-center">
        <span className={`text-meta uppercase ${mutedClass}`}>{t('exercises.' + ex.id)}</span>
        <div className="flex items-center gap-3">
          <span className="tabular-nums">{ex.weight}kg</span>
          <div className="flex gap-0.5">{ex.setsCompleted.map((r, ri) => (
            <div key={ri} className={r === targetReps(ex, ri) ? 'w-1.5 h-1.5 rounded-full bg-accent' : 'w-1.5 h-1.5 rounded-full border border-ink/30'} />
          ))}</div>
        </div>
      </div>
    ))}</div>
  </button>
);

const LogScreen = ({
  history, preset, program, weights, mcTop, mcInterval, mcPress, getCurrentDay, setEditingEntry,
  logGrouping, setLogGrouping, expandedGroups, setExpandedGroups,
}) => {
  const { t } = useTranslation();
  const mutedClass = 'text-ink/62';
  const renderEntry = (s, key, onClick) => <LogEntry key={key} session={s} onClick={onClick} mutedClass={mutedClass} t={t} />;
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
