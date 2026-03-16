import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowLeft } from 'lucide-react';
import { EXERCISE_NAMES, EXPECTED_WEIGHT_KEYS } from '../constants';
import { buildExerciseTimeline, buildBig3Timeline } from '../utils/chartData';

const RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: null },
];

const WEIGHT_COLOR = '#6366f1';
const E1RM_COLOR = '#10b981';

const RANGE_STORAGE_KEY = 'strength5x5_stats_range';

const StatsChart = ({ exerciseId, history, isDark, onBack, weights, best1RMs }) => {
  const [range, setRange] = useState(() => {
    try { return localStorage.getItem(RANGE_STORAGE_KEY) || '6M'; } catch { return '6M'; }
  });
  const [showWeight, setShowWeight] = useState(true);
  const [showE1rm, setShowE1rm] = useState(false);

  const isBig3 = exerciseId === 'big3';
  const title = isBig3 ? 'Big 3 Total' : EXERCISE_NAMES[exerciseId];
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

  const axisColor = isDark ? '#475569' : '#cbd5e1';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          aria-label="Back to stats"
          className={`p-2.5 rounded-2xl border transition-all active:scale-95 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-black uppercase tracking-tighter">{title}</h2>
          <p className="text-sm font-black">
            {showWeight && <span style={{ color: WEIGHT_COLOR }}>{currentWeight}kg</span>}
            {showWeight && showE1rm && <span className="text-slate-500"> / </span>}
            {showE1rm && <span style={{ color: E1RM_COLOR }}>Est. 1RM {currentE1rm}kg</span>}
          </p>
        </div>
      </div>

      <div className={`p-5 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className="flex gap-1.5 mb-5">
          {RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => { setRange(r.label); try { localStorage.setItem(RANGE_STORAGE_KEY, r.label); } catch {} }}
              className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${range === r.label ? 'bg-indigo-600 text-white shadow-lg' : (isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {filteredData.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500 text-sm font-bold">No data for this range</p>
          </div>
        ) : (
          <div className="h-56 relative">
            {filteredData.length === 1 && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <p className={`text-xs font-bold px-4 py-2 rounded-xl ${isDark ? 'bg-slate-800/90 text-slate-400' : 'bg-white/90 text-slate-500'}`}>Complete at least 2 sessions to see trends</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 10, fontWeight: 700, fill: textColor }}
                  stroke={axisColor}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 700, fill: textColor }}
                  stroke={axisColor}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  unit="kg"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    borderRadius: '1rem',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  formatter={(val, name) => [`${val}kg`, name === 'weight' ? 'Weight' : 'Est. 1RM']}
                />
                {showWeight && (
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke={WEIGHT_COLOR}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: WEIGHT_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: WEIGHT_COLOR, strokeWidth: 2, stroke: isDark ? '#0f172a' : '#ffffff' }}
                  />
                )}
                {showE1rm && (
                  <Line
                    type="monotone"
                    dataKey="e1rm"
                    stroke={E1RM_COLOR}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: E1RM_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: E1RM_COLOR, strokeWidth: 2, stroke: isDark ? '#0f172a' : '#ffffff' }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={toggleWeight}
            className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${showWeight ? 'bg-indigo-600 text-white shadow-lg' : (isDark ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-200')}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: WEIGHT_COLOR }} />
            Weight
          </button>
          <button
            onClick={toggleE1rm}
            className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${showE1rm ? 'bg-emerald-600 text-white shadow-lg' : (isDark ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-200')}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: E1RM_COLOR }} />
            Est. 1RM
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsChart;
