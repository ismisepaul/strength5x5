import React from 'react';

// The bottom-sheet shell: role/aria wiring, backdrop, `14px 14px 0 0` radius, and
// backdrop-click-to-close (the inner card stops propagation so tapping its content
// doesn't dismiss it).
const Sheet = ({ ariaLabel, z, onClose, cardClassName = '', children }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel}
    onClick={onClose}
    className={`fixed inset-0 ${z} flex items-end justify-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]`}
  >
    <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-t-sheet pt-[22px] px-5 pb-6 bg-surface ${cardClassName}`}>
      {children}
    </div>
  </div>
);

export default Sheet;
