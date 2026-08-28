import React from 'react';

const SIZE_CLASSES = { 40: 'w-10 h-10', 44: 'w-11 h-11' };

// `dimmed` is a visual-only affordance for a stepper pressed against a bound it can't
// move past (RestIntervalControl at its 0:30 floor or 5:00 ceiling) -- the button stays
// clickable rather than `disabled`, since tapping it there is what surfaces the
// explanation for why it won't go further.
const StepperButton = ({ onClick, onMouseDown, ariaLabel, icon: Icon, size = 40, iconSize = 16, dimmed = false }) => (
  <button
    onClick={onClick}
    onMouseDown={onMouseDown}
    aria-label={ariaLabel}
    className={`${SIZE_CLASSES[size]} rounded-lg border flex items-center justify-center shrink-0 active:scale-90 border-ink/26 text-ink/60 ${dimmed ? 'opacity-35' : ''}`}
  >
    <Icon size={iconSize} />
  </button>
);

export default StepperButton;
