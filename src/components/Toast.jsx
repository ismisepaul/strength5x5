import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const COLORS = {
  success: { bg: 'bg-emerald-600', text: 'text-white' },
  error: { bg: 'bg-rose-600', text: 'text-white' },
  info: { bg: 'bg-indigo-600', text: 'text-white' },
};

const Toast = React.memo(({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-14 inset-x-0 z-[600] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map(t => {
        const Icon = ICONS[t.type] || ICONS.info;
        const colors = COLORS[t.type] || COLORS.info;
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto max-w-sm w-full px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-[slideIn_0.2s_ease-out] ${colors.bg} ${colors.text}`}
          >
            <Icon size={18} className="shrink-0" />
            <span className="text-sm font-bold flex-1">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
});

export default Toast;
