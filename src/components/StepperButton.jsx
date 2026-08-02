import React from 'react';

const SIZE_CLASSES = { 40: 'w-10 h-10', 44: 'w-11 h-11' };

const StepperButton = ({ onClick, ariaLabel, icon: Icon, isDark, size = 40, iconSize = 16 }) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    className={`${SIZE_CLASSES[size]} rounded-lg border flex items-center justify-center shrink-0 active:scale-90 ${isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60'}`}
  >
    <Icon size={iconSize} />
  </button>
);

export default StepperButton;
