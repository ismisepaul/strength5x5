import React from 'react';

// The bottom-sheet shell: role/aria wiring, backdrop, `14px 14px 0 0` radius, a drag
// handle, and backdrop-click-to-close (the inner card stops propagation so tapping its
// content doesn't dismiss it). `onBackdropClick` lets a caller override just the
// backdrop tap -- e.g. EditEntryModal guards it while the entry is dirty, but the X
// button still closes unconditionally via `onClose`. Defaults to `onClose` for every
// other sheet, so backdrop-tap-to-close keeps working exactly as before.
const Sheet = ({ ariaLabel, z, onClose, onBackdropClick, cardClassName = '', children }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel}
    onClick={onBackdropClick ?? onClose}
    className={`fixed inset-0 ${z} flex items-end justify-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]`}
  >
    <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-t-sheet pt-[22px] px-5 pb-6 bg-surface ${cardClassName}`}>
      <div className="w-10 h-1 rounded-full bg-ink/20 mx-auto mb-3" />
      {children}
    </div>
  </div>
);

export default Sheet;
