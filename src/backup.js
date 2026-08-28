import i18n from './i18n/index.js';
import {
  validateImportData, normalizeProgram, normalizePreset, normalizePreferredRest,
  normalizeMcTop, normalizeMcWeek, normalizeMcInterval, normalizeMcPress, normalizeMcNextDay, normalizeMcPending,
  normalizeMcSeeded,
} from './utils';
import { convertStrongliftsCSV } from './utils/convertStronglifts';

// The state-hydration sequence shared by a local-file restore and a Google Drive
// restore -- both land on the same shape of backup data, so both need the same 15
// setter calls in the same order. `setters` is the subset of App.jsx's useState
// setters this touches; callers add their own follow-up (toast, tab switch, Drive
// echo) after this returns.
export const hydrateFromBackup = (d, setters) => {
  const {
    setWeights, setProgram, setHistory, setCurrentWorkoutType, setIsDark, setLocalBackup,
    setPreferredRest, setSoundEnabled, setVibrationEnabled, setRestWarningEnabled, setLogGrouping,
    setPreset, setMcTop, setMcWeek, setMcInterval, setMcPress, setMcNextDay, setMcPending, setMcSeeded,
  } = setters;

  setWeights(d.weights); setProgram(normalizeProgram(d.program)); setHistory(d.history);
  if (d.nextType) setCurrentWorkoutType(d.nextType);
  setIsDark(d.isDark ?? true); setLocalBackup(d.autoSave ?? false);
  // Presence, not truthiness: validateImportData lets any finite preferredRest through,
  // so a 0 in the file has to reach the normalizer and be clamped to CUSTOM_REST_MIN
  // like every other out-of-range value rather than falling through and silently
  // leaving the previous interval in place.
  if (d.preferredRest !== undefined) setPreferredRest(normalizePreferredRest(d.preferredRest));
  if (d.soundEnabled !== undefined) setSoundEnabled(d.soundEnabled);
  if (d.vibrationEnabled !== undefined) setVibrationEnabled(d.vibrationEnabled);
  if (d.restWarningEnabled !== undefined) setRestWarningEnabled(d.restWarningEnabled);
  if (d.logGrouping) setLogGrouping(d.logGrouping);
  if (d.language) i18n.changeLanguage(d.language);
  setPreset(normalizePreset(d.preset));
  setMcTop(normalizeMcTop(d.mcTop, d.weights));
  setMcWeek(normalizeMcWeek(d.mcWeek));
  setMcInterval(normalizeMcInterval(d.mcInterval));
  setMcPress(normalizeMcPress(d.mcPress));
  setMcNextDay(normalizeMcNextDay(d.mcNextDay));
  setMcPending(normalizeMcPending(d.mcPending));
  setMcSeeded(normalizeMcSeeded(d.mcSeeded, d));
};

// Reads and validates a local JSON backup file. Rejects with `.code` set so the
// caller can pick the right toast: 'invalidBackup' for a well-formed file that fails
// schema validation, anything else (JSON.parse throwing, etc.) for an unreadable one.
export const readBackupFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const raw = JSON.parse(event.target.result);
      const d = validateImportData(raw);
      if (!d) {
        console.warn('Import failed: invalid data structure');
        reject(Object.assign(new Error('Invalid backup data'), { code: 'invalidBackup' }));
        return;
      }
      resolve(d);
    } catch (err) {
      console.warn('Import failed:', err);
      reject(err);
    }
  };
  reader.readAsText(file);
});

// Reads and converts a StrongLifts CSV export. Rejects with `.code` set to
// 'noValidWorkouts' when the file parses but contains no usable sessions.
export const readStrongliftsFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const result = convertStrongliftsCSV(event.target.result);
      if (!result.history.length) {
        console.warn('StrongLifts import failed: no valid workouts found');
        reject(Object.assign(new Error('No valid workouts found'), { code: 'noValidWorkouts' }));
        return;
      }
      resolve(result);
    } catch (err) {
      console.warn('StrongLifts import failed:', err);
      reject(err);
    }
  };
  reader.readAsText(file);
});
