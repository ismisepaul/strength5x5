import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretRight } from '@phosphor-icons/react';
import { EXPECTED_WEIGHT_KEYS } from '../constants';
import { normalizePreset } from '../utils';
import { getProgram, PROGRAM_IDS, programAllLiftIds } from '../programs';
import { buildExerciseTimeline, buildBig3Timeline, getWeightDelta, filterByRange, STATS_RANGES } from '../utils/chartData';
import Sparkline from '../components/Sparkline';
import Segmented from '../components/Segmented';
import StatsChart from '../components/StatsChart';

const BIG3_IDS = ['squat', 'bench', 'deadlift'];
const RANGE_STORAGE_KEY = 'strength5x5_stats_range';

const StatsScreen = ({
  history, statsView, setStatsView, weights, best1RMs, big3Total,
  preset, program, mcTop, mcInterval, mcPress,
}) => {
  const { t } = useTranslation();
  const mutedClass = 'text-ink/62';
  const cardClass = 'w-full p-4 rounded-[10px] border flex justify-between items-center active:scale-[0.98] transition-transform bg-surface border-ink/14';

  // Owned here rather than inside StatsChart so the sparklines below and the detail
  // chart read the same selection -- picking a range in either place keeps it picked
  // everywhere else that shows one, including across the list<->detail transition.
  const [range, setRange] = useState(() => {
    try { return localStorage.getItem(RANGE_STORAGE_KEY) || '6M'; } catch { return '6M'; }
  });
  const handleRangeChange = (val) => {
    setRange(val);
    try { localStorage.setItem(RANGE_STORAGE_KEY, val); } catch {}
  };

  return (
    <div className="space-y-6">
      {history.length === 0 ? (
        <div className="py-20 text-center px-10">
          <h2 className="font-display font-semibold tracking-[-0.025em] text-lg mb-2">{t('stats.noStats')}</h2>
          <p className={`text-card leading-relaxed ${mutedClass}`}>{t('stats.noStatsBody')}</p>
        </div>
      ) : (
        <>
          {!statsView && <h2 className="font-display text-title font-semibold tracking-[-0.025em] mb-4">{t('stats.title')}</h2>}
          <Segmented
            options={STATS_RANGES.map(r => ({ label: r.label, val: r.label }))}
            value={range}
            onChange={handleRangeChange}
          />
          {statsView ? (
            <StatsChart exerciseId={statsView} history={history} onBack={() => setStatsView(null)} weights={weights} best1RMs={best1RMs} range={range} />
          ) : (
            <>
              {(() => {
                const big3Timeline = buildBig3Timeline(history);
                const big3Delta = getWeightDelta(big3Timeline);
                const rangedBig3 = filterByRange(big3Timeline, range);
                return (
                  <button onClick={() => setStatsView('big3')} className="w-full p-4 rounded-[10px] border text-left active:scale-[0.98] transition-transform bg-surface border-ink/14">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-accent-300">{t('stats.big3Total')}</p>
                      <CaretRight size={18} className={mutedClass} />
                    </div>
                    <div className="flex items-end justify-between gap-3 mb-4">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className="font-display font-semibold text-hero tabular-nums">{big3Total}kg</p>
                        {big3Delta !== null && (
                          <>
                            <span className={`text-meta px-2 py-0.5 rounded-md whitespace-nowrap ${big3Delta === 0 ? mutedClass : 'text-accent-300 bg-accent-900'}`}>
                              {big3Delta === 0 ? t('stats.held') : `${big3Delta > 0 ? '+' : ''}${big3Delta}kg`}
                            </span>
                            <span className={`text-tab whitespace-nowrap ${mutedClass}`}>{t('stats.vsLastWorkout')}</span>
                          </>
                        )}
                      </div>
                      {rangedBig3.length >= 2 && (
                        <Sparkline values={rangedBig3.map(p => p.weight)} width={96} height={32} className="text-accent-300 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 pt-3 rule-fade-top">
                      {BIG3_IDS.map(id => (
                        <div key={id} className="flex-1 min-w-0">
                          <p className={`text-tab uppercase tracking-wide truncate ${mutedClass}`}>{t('exercises.' + id)}</p>
                          <p className="font-display font-semibold text-body tabular-nums">{weights[id]}kg</p>
                        </div>
                      ))}
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
                  const rangedTimeline = filterByRange(timeline, range);
                  return (
                    <button key={id} onClick={() => setStatsView(id)} className={cardClass}>
                      <div className="min-w-0 pr-2 text-left">
                        <p className="font-display font-semibold tracking-[-0.025em] text-card truncate">{t('exercises.' + id)}</p>
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
                        {rangedTimeline.length >= 2 && <Sparkline values={rangedTimeline.map(p => p.weight)} width={48} height={20} className="text-accent-300" />}
                        <div className="text-right">
                          <p className="font-display font-semibold text-[17px] tabular-nums text-accent-300">{weights[id]}kg</p>
                          {delta !== null && (
                            <>
                              <p className={`text-tab ${mutedClass}`}>{delta === 0 ? t('stats.held') : `${delta > 0 ? '+' : ''}${delta}kg`}</p>
                              <p className={`text-tab ${mutedClass}`}>{t('stats.vsLastWorkout')}</p>
                            </>
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
        </>
      )}
    </div>
  );
};

export default StatsScreen;
