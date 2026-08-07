const BarMark = ({ size = 21, className = '' }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
    <rect x="2" y="28.5" width="60" height="7" rx="3.5" fill="currentColor" fillOpacity=".38" />
    <rect x="7" y="22" width="5.5" height="20" rx="2.5" fill="currentColor" />
    <rect x="51.5" y="22" width="5.5" height="20" rx="2.5" fill="currentColor" />
    <rect x="16" y="10" width="11" height="44" rx="3.5" fill="currentColor" />
    <rect x="37" y="10" width="11" height="44" rx="3.5" fill="currentColor" />
  </svg>
);

export default BarMark;
