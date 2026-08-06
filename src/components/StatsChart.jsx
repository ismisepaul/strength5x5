import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowLeft } from '@phosphor-icons/react';
import { EXPECTED_WEIGHT_KEYS } from '../constants';
import { buildExerciseTimeline, buildBig3Timeline, filterByRange, getExerciseRangeStats, getBig3Volume } from '../utils/chartData';
import { useTheme } from '../hooks/useTheme';

// range is owned by StatsScreen and shared with the lift-row sparklines -- this
// component only reads it, so the same range stays selected across the
// list-to-detail transition instead of two independent pickers drifting apart.
const StatsChart = ({ exerciseId, history, onBack, weights, best1RMs, range }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [showWeight, setShowWeight] = useState(true);
  const [showE1rm, setShowE1rm] = useState(false);

  const isBig3 = exerciseId === 'big3';
  const title = isBig3 ? t('stats.big3Total') : t('exercises.' + exerciseId);
  const currentWeight = isBig3
    ? (weights.squat + weights.bench + weights.deadlift)
    : weights[exerciseId];
  const currentE1rm = isBig3
    ? EXPECTED_WEIGHT_KEYS.filter(k => ['squat', 'bench', 'deadlift'].includes(k)).reduce((sum, k) => sum + (best1RMs[k] || weights[k]), 0)
    : (best1RMs[exerciseId] || weights[exerciseId]);

  const fullTimeline = useMemo(() => {
    return isBig3
      ? buildBig3Timeline(history)
      : buildExerciseTimeline(history, exerciseId);
  }, [history, exerciseId, isBig3]);

  const filteredData = useMemo(() => filterByRange(fullTimeline, range), [fullTimeline, range]);
  const maxWeightInRange = filteredData.length > 0 ? Math.max(...filteredData.map(p => p.weight)) : null;
  const sinceDelta = filteredData.length >= 2 ? filteredData[filteredData.length - 1].weight - filteredData[0].weight : null;
  const rangeStats = !isBig3 && filteredData.length > 0 ? getExerciseRangeStats(history, exerciseId, range) : null;
  const big3Volume = isBig3 && filteredData.length > 0 ? getBig3Volume(history, range) : null;

  const toggleWeight = () => {
    if (showWeight && !showE1rm) return;
    setShowWeight(prev => !prev);
  };

  const toggleE1rm = () => {
    if (showE1rm && !showWeight) return;
    setShowE1rm(prev => !prev);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const mutedClass = 'text-ink/62';
  // Recharts consumes these as literal prop values (SVG attrs / inline styles), not
  // Tailwind classNames, so they can't re-theme via the CSS custom properties alone.
  const axisColor = isDark ? 'rgba(236,233,226,.55)' : 'rgba(25,22,18,.55)';
  const weightColor = isDark ? '#c8663a' : '#b4552b';
  const e1rmColor = isDark ? '#eda175' : '#93401d';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          aria-label="Back to stats"
          className="w-10 h-10 rounded-lg border flex items-center justify-center active:scale-95 border-ink/26 text-ink/60"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-card tabular-nums">
            {showWeight && <span className="text-accent-300">{currentWeight}kg</span>}
            {showWeight && showE1rm && <span className={mutedClass}> / </span>}
            {showE1rm && <span className="text-accent-300">{t('stats.est1rmValue', { value: currentE1rm })}</span>}
          </p>
          {sinceDelta !== null && (
            <p className={`text-meta mt-0.5 ${mutedClass}`}>
              {t('stats.since', { date: new Date(filteredData[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })} · {sinceDelta > 0 ? '+' : ''}{sinceDelta}kg
            </p>
          )}
        </div>
      </div>

      <div className="p-4 rounded-[10px] border bg-surface border-ink/14">
        {filteredData.length === 0 ? (
          <div className="py-16 text-center">
            <p className={`text-card ${mutedClass}`}>{t('stats.noDataForRange')}</p>
          </div>
        ) : (
          <div className="h-56 relative">
            {filteredData.length === 1 && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <p className={`text-body px-4 py-2 rounded-lg bg-surface-deep/90 ${mutedClass}`}>{t('stats.minTwoWorkouts')}</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(236,233,226,.1)' : 'rgba(25,22,18,.1)'} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 11, fill: axisColor }}
                  stroke={axisColor}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  stroke={axisColor}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  unit="kg"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1f1d18' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(236,233,226,.14)' : 'rgba(25,22,18,.14)'}`,
                    borderRadius: '8px',
                    fontSize: 13.5,
                  }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  formatter={(val, name) => [`${val}kg`, name === 'weight' ? t('stats.weight') : t('stats.est1rm')]}
                />
                {showWeight && (
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke={weightColor}
                    strokeWidth={2}
                    dot={(dotProps) => {
                      const { cx, cy, payload, index } = dotProps;
                      const isPR = payload.weight === maxWeightInRange;
                      return isPR
                        ? <circle key={`pr-${index}`} cx={cx} cy={cy} r={5} fill="none" stroke={weightColor} strokeWidth={2} />
                        : <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={weightColor} strokeWidth={0} />;
                    }}
                    activeDot={{ r: 5, fill: weightColor, strokeWidth: 2, stroke: isDark ? '#141310' : '#ffffff' }}
                  />
                )}
                {showE1rm && (
                  <Line
                    type="monotone"
                    dataKey="e1rm"
                    stroke={e1rmColor}
                    strokeOpacity={0.55}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={{ r: 3, fill: e1rmColor, strokeWidth: 0, fillOpacity: 0.55 }}
                    activeDot={{ r: 5, fill: e1rmColor, strokeWidth: 2, stroke: isDark ? '#141310' : '#ffffff' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={toggleWeight}
            aria-pressed={showWeight}
            className={`flex-1 py-3 rounded-lg text-meta uppercase transition-all flex items-center justify-center gap-2 border ${showWeight ? 'border-accent text-accent-300' : 'border-ink/26 text-ink/62'}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: weightColor }} />
            {t('stats.weight')}
          </button>
          <button
            onClick={toggleE1rm}
            aria-pressed={showE1rm}
            className={`flex-1 py-3 rounded-lg text-meta uppercase transition-all flex items-center justify-center gap-2 border ${showE1rm ? 'border-accent text-accent-300' : 'border-ink/26 text-ink/62'}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e1rmColor }} />
            {t('stats.est1rm')}
          </button>
        </div>

        {rangeStats && (
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 rule-fade-top text-center">
            <div>
              <p className={`text-tab uppercase tracking-wide ${mutedClass}`}>{t('stats.bestSet')}</p>
              <p className="text-body font-medium tabular-nums mt-0.5">{rangeStats.bestSet ? `${rangeStats.bestSet.weight}kg × ${rangeStats.bestSet.reps}` : '—'}</p>
            </div>
            <div>
              <p className={`text-tab uppercase tracking-wide ${mutedClass}`}>{t('stats.volume')}</p>
              <p className="text-body font-medium tabular-nums mt-0.5">{Math.round(rangeStats.volume).toLocaleString()}kg</p>
            </div>
            <div>
              <p className={`text-tab uppercase tracking-wide ${mutedClass}`}>{t('stats.misses')}</p>
              <p className="text-body font-medium tabular-nums mt-0.5">{rangeStats.misses}</p>
            </div>
          </div>
        )}
        {big3Volume !== null && (
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 rule-fade-top text-center">
            <div>
              <p className={`text-tab uppercase tracking-wide ${mutedClass}`}>{t('stats.workoutsInRange')}</p>
              <p className="text-body font-medium tabular-nums mt-0.5">{filteredData.length}</p>
            </div>
            <div>
              <p className={`text-tab uppercase tracking-wide ${mutedClass}`}>{t('stats.volume')}</p>
              <p className="text-body font-medium tabular-nums mt-0.5">{Math.round(big3Volume).toLocaleString()}kg</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsChart;
