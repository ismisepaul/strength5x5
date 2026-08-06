const BarMark = ({ size = 20, className = '' }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
    <rect x="3" y="30" width="58" height="4" rx="2" fill="currentColor" fillOpacity=".32" />
    <g fill="currentColor">
      <rect x="16" y="22" width="5" height="20" rx="2" />
      <rect x="43" y="22" width="5" height="20" rx="2" />
      <rect x="24" y="13" width="6.5" height="38" rx="2.5" />
      <rect x="33.5" y="13" width="6.5" height="38" rx="2.5" />
    </g>
  </svg>
);

export default BarMark;
