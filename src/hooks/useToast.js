import { useState, useCallback, useRef } from 'react';

const DEFAULT_DURATIONS = { success: 2000, error: 4000, info: 3000 };
const MAX_TOASTS = 3;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, type = 'info', duration) => {
    const id = ++idRef.current;
    const ms = duration ?? DEFAULT_DURATIONS[type] ?? 3000;

    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, ms);
  }, []);

  return { toasts, showToast };
}
