import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown, Minus } from '@phosphor-icons/react';
import { getWeekDayStates, getWeekTonnageComparison, getWeekLiftProjection, getWorkoutStats } from '../utils/chartData';
import WeekPips from './WeekPips';

const DAY_BOX = 'flex-1 h-[30px] rounded-lg flex items-center justify-center text-[11px] font-medium';
const DAY_STATE_CLASS = {
  trained: 'border border-accent bg-accent-900 text-accent-300',
  todayTrain: 'border border-dashed border-accent text-accent-300',
  todayRest: 'border border-dashed border-ink/40 text-ink/62',
  todayComplete: 'border border-dashed border-ink/40 text-ink/62',
  rest: 'border border-ink/10 text-ink/30',
  available: 'border border-dotted border-accent/55 text-ink/62',
};

// The retrospective week surface Log owns per design 6a: a full seven-day strip, each
// Big-5 lift's forward projection for the week, and tonnage banked vs last week. Train
// keeps only the verdict line + <WeekPips> -- this card is where "which days, which
// lifts, how much" actually lives.
const WeekProgressCard = ({ history, remainingSessionLiftIds, ramped, increments }) => {
  const { t } = useTranslation();

  const days = getWeekDayStates(history);
  const done = getWorkoutStats(history).thisWeek;
  const weekDone = done >= 3;
  const { thisWeek, delta } = getWeekTonnageComparison(history);
  const lifts = getWeekLiftProjection(history, { remainingSessionLiftIds, ramped, increments });

  const dayStateKey = (d) => {
    if (d.trained) return 'trained';
    if (d.isToday) return weekDone ? 'todayComplete' : d.state === 'rest' ? 'todayRest' : 'todayTrain';
    return d.state;
  };
  const dayLabelKey = (d, key) => {
    if (key === 'trained') return 'log.weekCard.day.trained';
    if (key === 'todayTrain') return 'log.weekCard.day.todayTrain';
    if (key === 'todayRest') return 'log.weekCard.day.todayRest';
    if (key === 'todayComplete') return 'log.weekCard.day.todayComplete';
    if (key === 'rest') return 'log.weekCard.day.rest';
    return 'log.weekCard.day.available';
  };

  const TrendIcon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const trendLabel = delta > 0
    ? t('log.weekCard.moreVsLastWeek', { amount: delta.toLocaleString() })
    : delta < 0
      ? t('log.weekCard.lessVsLastWeek', { amount: Math.abs(delta).toLocaleString() })
      : t('log.weekCard.sameAsLastWeek');
  const trendClass = delta > 0 ? 'text-accent-300' : 'text-ink/62';

  return (
    <div className={`p-3.5 rounded-[10px] border bg-surface flex flex-col gap-3.5 ${weekDone ? 'border-accent' : 'border-ink/14'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-accent-300">{t('log.weekCard.thisWeek')}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-display font-semibold text-body">{weekDone ? t('log.weekCard.weekComplete') : t('log.weekCard.toGo', { count: 3 - done })}</span>
          <WeekPips done={done} />
        </span>
      </div>

      <div className="flex gap-[5px]">
        {days.map((d, i) => {
          const key = dayStateKey(d);
          return (
            <span key={i} title={t(dayLabelKey(d, key))} aria-label={t(dayLabelKey(d, key))} className={`${DAY_BOX} ${DAY_STATE_CLASS[key]}`}>
              {d.label}
            </span>
          );
        })}
      </div>

      <div className="flex flex-col gap-2.5">
        {lifts.map(({ id, progress }) => (
          <div key={id} className="flex items-center justify-between gap-2.5">
            <span className="text-body">{t('exercises.' + id)}</span>
            {progress.status === 'up' && (
              <span className="font-display font-semibold text-body tabular-nums text-accent-300">{progress.from} → {progress.to} kg</span>
            )}
            {progress.status === 'deload' && (
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-tab px-1.5 py-0.5 rounded-md border border-dashed border-ink/40 text-ink/62">{t('log.weekCard.deloadChip')}</span>
                <span className="font-display font-semibold text-body tabular-nums text-ink/62">{progress.from} → {progress.to} kg</span>
              </span>
            )}
            {progress.status === 'held' && (
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-tab px-1.5 py-0.5 rounded-md border border-dashed border-ink/40 text-ink/62">{t('log.miss', { count: 1 })}</span>
                <span className="font-display font-semibold text-body tabular-nums text-ink/62">{t('log.weekCard.holds', { weight: progress.weight })}</span>
              </span>
            )}
            {(progress.status === 'flat' || progress.status === 'first') && (
              <span className="font-display font-semibold text-body tabular-nums text-ink/62">{progress.weight} kg</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between pt-3 rule-fade-top">
        <span className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-ink/62">{t('log.weekCard.liftedThisWeek')}</span>
        <span className="flex items-baseline gap-2">
          <span className="font-display font-semibold text-body tabular-nums text-ink/85">{thisWeek.toLocaleString()} kg</span>
          <span className={`inline-flex items-center gap-[3px] text-tab ${trendClass}`}>
            <TrendIcon size={11} weight="bold" className="shrink-0" />
            {trendLabel}
          </span>
        </span>
      </div>
    </div>
  );
};

export default WeekProgressCard;
