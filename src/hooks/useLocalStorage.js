import { useMemo, useEffect, useCallback } from 'react';
import { STORAGE_KEY, SCHEMA_VERSION, ACTIVE_SESSION_KEY } from '../constants';
import { migrate } from '../utils';

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function useLoadSaved() {
  return useMemo(() => {
    let saved = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const version = parsed.version ?? 1;
        saved = version < SCHEMA_VERSION ? migrate(parsed, version) : parsed;
      }
    } catch { /* ignore */ }

    try {
      const activeRaw = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (activeRaw) {
        const active = JSON.parse(activeRaw);
        const sessionDate = new Date(active.session?.date);
        if (Date.now() - sessionDate.getTime() > SESSION_MAX_AGE_MS) {
          localStorage.removeItem(ACTIVE_SESSION_KEY);
        } else {
          saved.activeSession = active;
        }
      }
    } catch { /* ignore */ }

    return saved;
  }, []);
}

export function useSyncStorage(state) {
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: SCHEMA_VERSION,
      ...state,
    }));
  }, [state]);
}

export function useStorageSync(key, onUpdate) {
  const onUpdateRef = { current: onUpdate };
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const handler = (e) => {
      if (e.key === key && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          onUpdateRef.current?.(updated);
        } catch { /* ignore malformed cross-tab data */ }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key]);
}
