import React from 'react';
import { CheckCircle, WarningCircle, Info } from '@phosphor-icons/react';

const ICONS = {
  success: CheckCircle,
  error: WarningCircle,
  info: Info,
};

const Toast = React.memo(({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-x-0 z-[600] flex flex-col items-center gap-2 pointer-events-none px-4" style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}>
      {toasts.map(t => {
        const Icon = ICONS[t.type] || ICONS.info;
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className="pointer-events-auto max-w-sm w-full px-4 py-3 rounded-lg border border-accent bg-accent-900 text-accent-300 flex items-center gap-3 animate-[slideIn_0.2s_ease-out]"
          >
            <Icon size={18} className="shrink-0" />
            <span className="text-[15px] flex-1">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
});

export default Toast;
