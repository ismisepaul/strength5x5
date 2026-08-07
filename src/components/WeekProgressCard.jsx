import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDown, ArrowUp, ArrowDown, Minus } from '@phosphor-icons/react';
import { getWeekDayStates, getWeekTonnageComparison, getWeekLiftBreakdown } from '../utils/chartData';

// The days row plus a week-over-week tonnage line double as the disclosure trigger --
// tapping either opens the per-lift breakdown. Up is accent, everything else (held,
// deload, flat) is neutral ink; state is never carried by hue alone, only by that pairing
// with the dashed miss/deload chip or the arrow direction.
const WeekProgressCard = ({ history }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const days = getWeekDayStates(history);
  const { thisWeek, lastWeek, delta } = getWeekTonnageComparison(history);
  const lifts = getWeekLiftBreakdown(history);

  const TrendIcon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const trendLabel = delta > 0
    ? t('workout.weekCard.moreThanLastWeek', { amount: delta.toLocaleString() })
    : delta < 0
      ? t('workout.weekCard.lessThanLastWeek', { amount: Math.abs(delta).toLocaleString() })
      : t('workout.weekCard.sameAsLastWeek');
  const trendClass = delta > 0 ? 'text-accent-300' : 'text-ink/62';

  return (
    <div className="mt-3.5 pt-0.5 rule-fade-top">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={t('workout.weekCard.toggleAria')}
        className="w-full min-h-11 pt-3.5 pb-3 flex flex-col gap-3 text-left"
      >
        <span className="flex items-end gap-[5px] w-full">
          {days.map((d, i) => (
            <span key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span
                className={`w-full h-[26px] rounded-lg ${
                  d.trained
                    ? 'border border-accent bg-accent-900'
                    : d.isToday
                      ? 'border border-dashed border-accent'
                      : 'border border-ink/14'
                }`}
              />
              <span className={`text-tab ${d.trained ? 'text-ink/62' : d.isToday ? 'text-accent-300' : 'text-ink/35'}`}>{d.label}</span>
            </span>
          ))}
        </span>
        <span className="flex items-center justify-between gap-3 w-full">
          <span className={`inline-flex items-center gap-1.5 text-meta min-w-0 ${trendClass}`}>
            <TrendIcon size={12} weight="bold" className="shrink-0" />
            <span className="truncate">{trendLabel}</span>
          </span>
          <CaretDown size={16} weight="bold" className={`text-ink/45 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="pt-3 pb-1 flex flex-col gap-3 rule-fade-top">
          {lifts.map(({ id, progress }) => (
            <div key={id} className="flex items-center justify-between gap-2.5">
              <span className="text-body">{t('exercises.' + id)}</span>
              {progress.status === 'up' && (
                <span className="font-display font-semibold text-body tabular-nums text-accent-300">{progress.from} → {progress.to} kg</span>
              )}
              {progress.status === 'deload' && (
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-tab px-1.5 py-0.5 rounded-md border border-dashed border-ink/40 text-ink/62">{t('workout.weekCard.deloadChip')}</span>
                  <span className="font-display font-semibold text-body tabular-nums text-ink/62">{progress.from} → {progress.to} kg</span>
                </span>
              )}
              {progress.status === 'held' && (
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-tab px-1.5 py-0.5 rounded-md border border-dashed border-ink/40 text-ink/62">{t('log.miss', { count: 1 })}</span>
                  <span className="font-display font-semibold text-body tabular-nums text-ink/62">{t('workout.weekCard.holds', { weight: progress.weight })}</span>
                </span>
              )}
              {(progress.status === 'flat' || progress.status === 'first') && (
                <span className="font-display font-semibold text-body tabular-nums text-ink/62">{progress.weight} kg</span>
              )}
            </div>
          ))}
          <div className="flex items-baseline justify-between pt-3 rule-fade-top">
            <span className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-ink/62">{t('workout.weekCard.liftedThisWeek')}</span>
            <span className="font-mono text-meta text-ink/62">{t('workout.weekCard.weekTotalVsLast', { amount: thisWeek.toLocaleString(), last: lastWeek.toLocaleString() })}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeekProgressCard;
