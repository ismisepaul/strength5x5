import React from 'react';

// 52px is the bottom-sheet "hero" size -- a value with no other way to reach it
// (CustomRestSheet) gets a bigger thumb target than the 44px Train uses for a value
// that's also typeable, since there's no keyboard fallback in a sheet.
const SIZE_CLASSES = { 40: 'w-10 h-10', 44: 'w-11 h-11', 52: 'w-[52px] h-[52px]' };

const StepperButton = ({ onClick, onMouseDown, ariaLabel, icon: Icon, size = 40, iconSize = 16 }) => (
  <button
    onClick={onClick}
    onMouseDown={onMouseDown}
    aria-label={ariaLabel}
    className={`${SIZE_CLASSES[size]} rounded-lg border flex items-center justify-center shrink-0 active:scale-90 border-ink/26 text-ink/60`}
  >
    <Icon size={iconSize} />
  </button>
);

export default StepperButton;
