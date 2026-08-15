import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../../state/useSettings';

describe('useSettings', () => {
  it('defaults preferredRest to 90 and logGrouping to all when saved is empty', () => {
    const { result } = renderHook(() => useSettings({}));
    expect(result.current.preferredRest).toBe(90);
    expect(result.current.logGrouping).toBe('all');
    expect(result.current.localBackup).toBe(false);
    expect(result.current.soundEnabled).toBe(false);
  });

  // The only setting in the app that defaults on. It's inert until soundEnabled is
  // also on, which is what lets it default that way without making noise unasked.
  it('defaults restWarningEnabled to true when saved is empty', () => {
    const { result } = renderHook(() => useSettings({}));
    expect(result.current.restWarningEnabled).toBe(true);
  });

  it('reads an explicit false for restWarningEnabled rather than falling back to the default', () => {
    const { result } = renderHook(() => useSettings({ restWarningEnabled: false }));
    expect(result.current.restWarningEnabled).toBe(false);
  });

  it('reads every field from saved when present', () => {
    const saved = {
      isDark: false, autoSave: true, preferredRest: 180,
      soundEnabled: true, vibrationEnabled: true, restWarningEnabled: false, logGrouping: 'week',
    };
    const { result } = renderHook(() => useSettings(saved));
    expect(result.current.isDark).toBe(false);
    expect(result.current.localBackup).toBe(true);
    expect(result.current.preferredRest).toBe(180);
    expect(result.current.soundEnabled).toBe(true);
    expect(result.current.vibrationEnabled).toBe(true);
    expect(result.current.restWarningEnabled).toBe(false);
    expect(result.current.logGrouping).toBe('week');
  });

  it('falls back to the legacy hapticsEnabled key when vibrationEnabled is absent', () => {
    const { result } = renderHook(() => useSettings({ hapticsEnabled: true }));
    expect(result.current.vibrationEnabled).toBe(true);
  });

  it('setters update their own field only', () => {
    const { result } = renderHook(() => useSettings({}));
    act(() => { result.current.setPreferredRest(300); });
    expect(result.current.preferredRest).toBe(300);
    expect(result.current.soundEnabled).toBe(false);
  });
});
