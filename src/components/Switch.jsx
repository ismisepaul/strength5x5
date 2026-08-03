import React from 'react';

const Switch = ({ checked, onChange, ariaLabel }) => (
  <button
    onClick={onChange}
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    className={`w-[46px] h-[26px] rounded-full border relative shrink-0 transition-colors ${checked ? 'border-accent bg-accent-900' : 'border-ink/18'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${checked ? 'translate-x-[21px] bg-accent' : 'translate-x-0 bg-ink/45'}`} />
  </button>
);

export default Switch;
