import React from 'react';

// The centred-dialog shell shared by every modal: role/aria wiring, backdrop, and
// the border/radius/surface treatment. Alignment and scroll behaviour stay
// caller-controlled -- a text-centred alert and a left-aligned scrollable form
// need different outer layout, but both are still "a centred dialog".
const Modal = ({ ariaLabel, z, align = 'center', scrollable = false, onBackdropClick, cardClassName = '', children }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel}
    onClick={onBackdropClick}
    className={`fixed inset-0 ${z} flex ${align === 'start' ? 'items-start' : 'items-center'} justify-center ${scrollable ? 'overflow-y-auto overscroll-contain' : ''} ${align === 'center' ? 'p-6 text-center' : ''} backdrop-blur-sm bg-[rgba(15,16,25,.75)]`}
  >
    <div
      className={`w-full rounded-modal border bg-surface border-ink/14 ${cardClassName}`}
      onClick={onBackdropClick ? (e) => e.stopPropagation() : undefined}
    >
      {children}
    </div>
  </div>
);

export default Modal;
