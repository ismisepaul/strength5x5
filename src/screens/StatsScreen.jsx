import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendUp, TrendDown, ArrowRight, CaretRight } from '@phosphor-icons/react';
import { EXPECTED_WEIGHT_KEYS } from '../constants';
import { normalizePreset } from '../utils';
import { getProgram, PROGRAM_IDS, programAllLiftIds } from '../programs';
import { getExerciseTrend, getBig3Trend } from '../utils/chartData';
import StatsChart from '../components/StatsChart';

const StatsScreen = ({
  history, statsView, setStatsView, weights, best1RMs, big3Total,
  preset, program, mcTop, mcInterval, mcPress,
}) => {
  const { t } = useTranslation();
  const mutedClass = 'text-ink/62';
  const cardClass = 'w-full p-4 rounded-[10px] border flex justify-between items-center active:scale-[0.98] transition-transform bg-surface border-ink/14';
  const trendIconFor = (trend) => trend === 'up' ? { Icon: TrendUp, className: 'text-accent' } : trend === 'down' ? { Icon: TrendDown, className: mutedClass } : { Icon: ArrowRight, className: 'text-ink/40' };

  return (
    <div className="space-y-6">
      {history.length === 0 ? (
        <div className="py-20 text-center px-10">
          <h2 className="text-lg font-semibold mb-2">{t('stats.noStats')}</h2>
          <p className={`text-card leading-relaxed ${mutedClass}`}>{t('stats.noStatsBody')}</p>
        </div>
      ) : statsView ? (
        <StatsChart exerciseId={statsView} history={history} onBack={() => setStatsView(null)} weights={weights} best1RMs={best1RMs} />
      ) : (
        <>
          <h2 className="text-title font-medium mb-4">{t('stats.title')}</h2>
          {(() => {
            const big3Trend = getBig3Trend(history);
            const { Icon: TrendIcon, className: trendClass } = trendIconFor(big3Trend);
            return (
              <button onClick={() => setStatsView('big3')} className={cardClass}>
                <div className="text-left">
                  <p className="text-kicker font-semibold uppercase tracking-[0.14em] text-accent mb-1">{t('stats.big3Total')}</p>
                  <p className="text-title font-medium tabular-nums">{big3Total}kg</p>
                </div>
                <div className="flex items-center gap-2">
                  {big3Trend && <TrendIcon size={18} className={trendClass} />}
                  <CaretRight size={18} className={mutedClass} />
                </div>
              </button>
            );
          })()}
          <div className="grid gap-3">{(() => {
            const activeIds = programAllLiftIds(preset, { program, weights, mcTop, mcInterval, mcPress });
            // Lifts trained under the other program stay visible here too, instead of
            // vanishing from Stats the moment you switch programs.
            const extraIds = [...EXPECTED_WEIGHT_KEYS, 'incline'].filter(id =>
              !activeIds.includes(id) && history.some(s => s.exercises?.some(e => e.id === id))
            );
            const otherProgramName = t(getProgram(PROGRAM_IDS.find(id => id !== normalizePreset(preset))).nameKey);
            return [...activeIds, ...extraIds].map(id => {
              const trend = getExerciseTrend(history, id);
              const { Icon: TrendIcon, className: trendClass } = trendIconFor(trend);
              const hasData = history.some(s => s.exercises?.some(e => e.id === id));
              const isExtra = extraIds.includes(id);
              return (
                <button key={id} onClick={() => setStatsView(id)} className={cardClass}>
                  <div className="min-w-0 pr-2 text-left">
                    <p className="text-card font-medium truncate">{t('exercises.' + id)}</p>
                    {hasData ? (
                      <p className={`text-meta uppercase leading-none mt-1 ${mutedClass}`}>{t('stats.est1rmValue', { value: best1RMs[id] || weights[id] })}</p>
                    ) : (
                      <p className={`text-meta leading-snug mt-1 ${mutedClass}`}>{t('stats.noSessionsForLift')}</p>
                    )}
                    {isExtra && (
                      <p className={`text-tab uppercase tracking-wide mt-0.5 ${mutedClass}`}>{t('stats.fromProgram', { program: otherProgramName })}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {trend && <TrendIcon size={18} className={trendClass} />}
                    <span className="text-accent-300 tabular-nums">{weights[id]}kg</span>
                    <CaretRight size={18} className={mutedClass} />
                  </div>
                </button>
              );
            });
          })()}
          </div>
        </>
      )}
    </div>
  );
};

export default StatsScreen;
