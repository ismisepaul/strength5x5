import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendUp, TrendDown, ArrowRight, CaretRight } from '@phosphor-icons/react';
import { EXPECTED_WEIGHT_KEYS } from '../constants';
import { normalizePreset } from '../utils';
import { getProgram, PROGRAM_IDS, programAllLiftIds } from '../programs';
import { buildExerciseTimeline, getBig3Trend, getWeightDelta } from '../utils/chartData';
import Sparkline from '../components/Sparkline';
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
                  <p className="text-kicker font-semibold uppercase tracking-[0.14em] text-accent-300 mb-1">{t('stats.big3Total')}</p>
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
              const hasData = history.some(s => s.exercises?.some(e => e.id === id));
              const isExtra = extraIds.includes(id);
              const timeline = hasData ? buildExerciseTimeline(history, id) : [];
              const delta = hasData ? getWeightDelta(timeline) : null;
              return (
                <button key={id} onClick={() => setStatsView(id)} className={cardClass}>
                  <div className="min-w-0 pr-2 text-left">
                    <p className="text-card font-medium truncate">{t('exercises.' + id)}</p>
                    {hasData ? (
                      <p className={`text-meta leading-none mt-1 ${mutedClass}`}>{t('stats.est1rmValue', { value: best1RMs[id] || weights[id] })}</p>
                    ) : (
                      <p className={`text-meta leading-snug mt-1 ${mutedClass}`}>{t('stats.noSessionsForLift')}</p>
                    )}
                    {isExtra && (
                      <p className={`text-tab uppercase tracking-wide mt-0.5 ${mutedClass}`}>{t('stats.fromProgram', { program: otherProgramName })}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {hasData && <Sparkline values={timeline.map(p => p.weight)} width={48} height={20} className="text-accent-300" />}
                    <div className="text-right">
                      <p className="text-[17px] font-medium tabular-nums text-accent-300">{weights[id]}kg</p>
                      {delta !== null && (
                        <p className={`text-tab ${mutedClass}`}>{delta === 0 ? t('stats.held') : `${delta > 0 ? '+' : ''}${delta}kg`}</p>
                      )}
                    </div>
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
