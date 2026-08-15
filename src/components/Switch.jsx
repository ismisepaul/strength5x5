import React from 'react';

// `disabled` is for a switch whose parent setting is off, so its own value can't do
// anything yet -- it stays readable (you can see what it's set to) but dims and stops
// taking taps, rather than sitting there looking on while silently doing nothing.
const Switch = ({ checked, onChange, ariaLabel, disabled = false }) => (
  <button
    onClick={onChange}
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    className={`w-[46px] h-[26px] rounded-full border relative shrink-0 transition-colors disabled:opacity-35 ${checked ? 'border-accent bg-accent-900' : 'border-ink/26'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${checked ? 'translate-x-[21px] bg-accent' : 'translate-x-0 bg-ink/62'}`} />
  </button>
);

export default Switch;
