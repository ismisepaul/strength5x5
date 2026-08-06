import React from 'react';

// Minimal, dependency-free trend line for inline use (lift rows, the Big-3 hero) --
// no axes/tooltip/interactivity, unlike the Recharts-based detail view. Values are
// normalized to a fixed viewBox so the line always fills the given box regardless
// of the data's actual range. Decorative -- the number it traces is always shown
// as text alongside it, so this stays hidden from screen readers.
const Sparkline = ({ values, width = 64, height = 24, strokeWidth = 1.75, className = '' }) => {
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default Sparkline;
