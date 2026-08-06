import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowLeft } from '@phosphor-icons/react';
import { EXPECTED_WEIGHT_KEYS } from '../constants';
import { buildExerciseTimeline, buildBig3Timeline } from '../utils/chartData';
import { useTheme } from '../hooks/useTheme';

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: null },
];

const RANGE_STORAGE_KEY = 'strength5x5_stats_range';

const StatsChart = ({ exerciseId, history, onBack, weights, best1RMs }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [range, setRange] = useState(() => {
    try { return localStorage.getItem(RANGE_STORAGE_KEY) || '6M'; } catch { return '6M'; }
  });
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

  const filteredData = useMemo(() => {
    const rangeDef = RANGES.find(r => r.label === range);
    if (!rangeDef?.days) return fullTimeline;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDef.days);
    return fullTimeline.filter(p => new Date(p.date) >= cutoff);
  }, [fullTimeline, range]);

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
  const axisColor = isDark ? 'rgba(236,233,226,.4)' : 'rgba(25,22,18,.4)';
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
            {showWeight && <span className="text-accent">{currentWeight}kg</span>}
            {showWeight && showE1rm && <span className={mutedClass}> / </span>}
            {showE1rm && <span className="text-accent-300">{t('stats.est1rmValue', { value: currentE1rm })}</span>}
          </p>
        </div>
      </div>

      <div className="p-4 rounded-[10px] border bg-surface border-ink/14">
        <div className="flex rounded-lg border overflow-hidden mb-4 border-ink/10">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => { setRange(r.label); try { localStorage.setItem(RANGE_STORAGE_KEY, r.label); } catch {} }}
              className={`flex-1 py-3 text-meta uppercase tracking-wide transition-all ${i > 0 ? 'border-l border-ink/10' : ''} ${range === r.label ? 'bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_var(--color-accent)]' : mutedClass}`}
            >
              {r.label}
            </button>
          ))}
        </div>

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
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(236,233,226,.07)' : 'rgba(25,22,18,.07)'} />
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
                    border: `1px solid ${isDark ? 'rgba(236,233,226,.1)' : 'rgba(25,22,18,.1)'}`,
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
                    dot={{ r: 3, fill: weightColor, strokeWidth: 0 }}
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
            className={`flex-1 py-3 rounded-lg text-meta uppercase transition-all flex items-center justify-center gap-2 border ${showWeight ? 'border-accent text-accent' : 'border-ink/26 text-ink/62'}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: weightColor }} />
            {t('stats.weight')}
          </button>
          <button
            onClick={toggleE1rm}
            aria-pressed={showE1rm}
            className={`flex-1 py-3 rounded-lg text-meta uppercase transition-all flex items-center justify-center gap-2 border ${showE1rm ? 'border-accent text-accent' : 'border-ink/26 text-ink/62'}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e1rmColor }} />
            {t('stats.est1rm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsChart;
