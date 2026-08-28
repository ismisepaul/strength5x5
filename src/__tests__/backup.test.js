import { describe, it, expect, vi } from 'vitest';
import { hydrateFromBackup, readBackupFile, readStrongliftsFile } from '../backup';
import { EXPECTED_WEIGHT_KEYS } from '../constants';

const baseWeights = Object.fromEntries(EXPECTED_WEIGHT_KEYS.map(k => [k, 60]));

const makeSetters = () => ({
  setWeights: vi.fn(), setProgram: vi.fn(), setHistory: vi.fn(), setCurrentWorkoutType: vi.fn(),
  setIsDark: vi.fn(), setLocalBackup: vi.fn(), setPreferredRest: vi.fn(), setSoundEnabled: vi.fn(),
  setVibrationEnabled: vi.fn(), setRestWarningEnabled: vi.fn(),
  setLogGrouping: vi.fn(), setPreset: vi.fn(), setMcTop: vi.fn(),
  setMcWeek: vi.fn(), setMcInterval: vi.fn(), setMcPress: vi.fn(), setMcNextDay: vi.fn(), setMcPending: vi.fn(),
  setMcSeeded: vi.fn(),
});

describe('hydrateFromBackup', () => {
  it('always sets weights, program and history unconditionally', () => {
    const setters = makeSetters();
    hydrateFromBackup({ weights: baseWeights, program: {}, history: [] }, setters);
    expect(setters.setWeights).toHaveBeenCalledWith(baseWeights);
    expect(setters.setHistory).toHaveBeenCalledWith([]);
  });

  it('only sets nextType, preferredRest, soundEnabled, vibrationEnabled, restWarningEnabled, logGrouping when present in the backup', () => {
    const setters = makeSetters();
    hydrateFromBackup({ weights: baseWeights, program: {}, history: [] }, setters);
    expect(setters.setCurrentWorkoutType).not.toHaveBeenCalled();
    expect(setters.setPreferredRest).not.toHaveBeenCalled();
    expect(setters.setSoundEnabled).not.toHaveBeenCalled();
    expect(setters.setVibrationEnabled).not.toHaveBeenCalled();
    expect(setters.setRestWarningEnabled).not.toHaveBeenCalled();
    expect(setters.setLogGrouping).not.toHaveBeenCalled();
  });

  it('clamps a restored preferredRest into the current CUSTOM_REST_MIN..MAX range', () => {
    // A backup made under an older, lower floor (or hand-edited) could carry a value
    // outside today's bounds -- restoring it should land in range, not import the
    // out-of-range number verbatim.
    const low = makeSetters();
    hydrateFromBackup({ weights: baseWeights, program: {}, history: [], preferredRest: 5 }, low);
    expect(low.setPreferredRest).toHaveBeenCalledWith(30);

    const high = makeSetters();
    hydrateFromBackup({ weights: baseWeights, program: {}, history: [], preferredRest: 9999 }, high);
    expect(high.setPreferredRest).toHaveBeenCalledWith(300);

    const inRange = makeSetters();
    hydrateFromBackup({ weights: baseWeights, program: {}, history: [], preferredRest: 120 }, inRange);
    expect(inRange.setPreferredRest).toHaveBeenCalledWith(120);

    // 0 is the one out-of-range value a truthiness guard would skip, leaving the
    // previous interval in place instead of clamping like every other bad value.
    const zero = makeSetters();
    hydrateFromBackup({ weights: baseWeights, program: {}, history: [], preferredRest: 0 }, zero);
    expect(zero.setPreferredRest).toHaveBeenCalledWith(30);
  });

  it('defaults isDark and autoSave to true/false when absent from the backup', () => {
    const setters = makeSetters();
    hydrateFromBackup({ weights: baseWeights, program: {}, history: [] }, setters);
    expect(setters.setIsDark).toHaveBeenCalledWith(true);
    expect(setters.setLocalBackup).toHaveBeenCalledWith(false);
  });

  it('respects an explicit false for soundEnabled/vibrationEnabled rather than skipping it', () => {
    const setters = makeSetters();
    hydrateFromBackup({ weights: baseWeights, program: {}, history: [], soundEnabled: false, vibrationEnabled: false }, setters);
    expect(setters.setSoundEnabled).toHaveBeenCalledWith(false);
    expect(setters.setVibrationEnabled).toHaveBeenCalledWith(false);
  });

  // restWarningEnabled is the one flag that defaults on, so skipping an explicit false
  // here wouldn't leave it unset -- it would silently turn the warning back on for
  // someone who had deliberately switched it off before backing up.
  it('respects an explicit false for restWarningEnabled rather than falling back to its default', () => {
    const setters = makeSetters();
    hydrateFromBackup({ weights: baseWeights, program: {}, history: [], restWarningEnabled: false }, setters);
    expect(setters.setRestWarningEnabled).toHaveBeenCalledWith(false);
  });

  it('always normalizes and sets every Madcow field, even when absent', () => {
    const setters = makeSetters();
    hydrateFromBackup({ weights: baseWeights, program: {}, history: [] }, setters);
    expect(setters.setPreset).toHaveBeenCalled();
    expect(setters.setMcTop).toHaveBeenCalled();
    expect(setters.setMcWeek).toHaveBeenCalled();
    expect(setters.setMcInterval).toHaveBeenCalled();
    expect(setters.setMcPress).toHaveBeenCalled();
    expect(setters.setMcNextDay).toHaveBeenCalled();
    expect(setters.setMcPending).toHaveBeenCalled();
    expect(setters.setMcSeeded).toHaveBeenCalled();
  });
});

describe('readBackupFile', () => {
  const validBackup = { weights: baseWeights, history: [] };

  it('resolves with the validated data for a well-formed backup', async () => {
    const file = new File([JSON.stringify(validBackup)], 'backup.json', { type: 'application/json' });
    const result = await readBackupFile(file);
    expect(result.weights.squat).toBe(60);
    expect(result.history).toEqual([]);
  });

  it('rejects with code invalidBackup for well-formed JSON that fails schema validation', async () => {
    const file = new File([JSON.stringify({ not: 'a backup' })], 'backup.json', { type: 'application/json' });
    await expect(readBackupFile(file)).rejects.toMatchObject({ code: 'invalidBackup' });
  });

  it('rejects for unparseable JSON', async () => {
    const file = new File(['not json'], 'backup.json', { type: 'application/json' });
    await expect(readBackupFile(file)).rejects.toBeInstanceOf(Error);
  });
});

describe('readStrongliftsFile', () => {
  it('rejects with code noValidWorkouts when the CSV parses but has no usable sessions', async () => {
    const file = new File(['just,a,header\n'], 'export.csv', { type: 'text/csv' });
    await expect(readStrongliftsFile(file)).rejects.toMatchObject({ code: 'noValidWorkouts' });
  });
});
