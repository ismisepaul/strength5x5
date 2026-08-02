import React from 'react';

const StepperButton = ({ onClick, ariaLabel, icon: Icon, isDark }) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 active:scale-90 ${isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60'}`}
  >
    <Icon size={16} />
  </button>
);

export default StepperButton;
