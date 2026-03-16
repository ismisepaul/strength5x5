import { useMemo, useEffect, useCallback } from 'react';
import { STORAGE_KEY, SCHEMA_VERSION } from '../constants';
import { migrate } from '../utils';

export function useLoadSaved() {
  return useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const version = parsed.version ?? 1;
      return version < SCHEMA_VERSION ? migrate(parsed, version) : parsed;
    } catch { return {}; }
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
