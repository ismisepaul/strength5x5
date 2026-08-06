import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_DURATIONS = { success: 2000, error: 4000, info: 3000 };
const ACTION_DURATION = 8000;
const MAX_TOASTS = 3;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // A fourth, optional arg lets a toast carry an action (e.g. Undo) -- action toasts
  // default to a longer visible duration so there's actually time to tap it. Tapping
  // the action is the caller's job (it has the toast's onAction); this hook only
  // owns showing/timing/dismissing.
  const showToast = useCallback((message, type = 'info', duration, { actionLabel, onAction } = {}) => {
    const id = ++idRef.current;
    const ms = duration ?? (onAction ? ACTION_DURATION : DEFAULT_DURATIONS[type] ?? 3000);

    setToasts(prev => {
      const next = [...prev, { id, message, type, actionLabel, onAction }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });

    const timer = setTimeout(() => dismiss(id), ms);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  // Eviction (see showToast) drops toasts without going through dismiss, so their
  // timers would otherwise fire against an id that's already gone. Reconciling here
  // covers every removal path, not just that one.
  useEffect(() => {
    const live = new Set(toasts.map(t => t.id));
    for (const [id, timer] of timersRef.current) {
      if (!live.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }
  }, [toasts]);

  return { toasts, showToast, dismiss };
}
