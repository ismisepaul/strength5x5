import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Barbell, ListChecks, Gear, Play,
  Question,
  CaretRight,
  Flame,
  SlidersHorizontal, ChartLineUp
} from '@phosphor-icons/react';

import { useTranslation } from 'react-i18next';
import i18n from './i18n/index.js';
import { INITIAL_WEIGHTS, STORAGE_KEY, SCHEMA_VERSION, EXPECTED_WEIGHT_KEYS, MAX_IMPORT_SIZE, ACTIVE_WORKOUT_KEY, MADCOW_DAYS, MADCOW_ONRAMP_WEEKS, MADCOW_DEFAULT_INTERVAL } from './constants';
import { calculateBest1RM, calculateSetDurations, normalizeProgram, targetReps, normalizePreset, normalizeMcTop, normalizeMcWeek, normalizeMcInterval, normalizeMcPress, normalizeMcNextDay, normalizeMcPending, seedMadcowTops, madcowTopsToWeights, applyMcTopToWeights, evaluateMadcowOutcome } from './utils';
import { clampMcTop, reviseWorkoutTopSet } from './madcow';
import { evaluateWorkoutOutcome, getStartDeloadPrompt } from './progression';
import { hydrateFromBackup, readBackupFile, readStrongliftsFile } from './backup';
import { getProgram } from './programs';
import { getWorkoutStats } from './utils/chartData';
import { useLoadSaved, useSyncStorage, useStorageSync } from './hooks/useLocalStorage';
import { useTimer } from './hooks/useTimer';
import { useWakeLock } from './hooks/useWakeLock';
import RestTimer from './components/RestTimer';
import RepPicker from './components/RepPicker';
import ProgramScreen from './screens/ProgramScreen';
import ExerciseGuideSheet from './components/ExerciseGuideSheet';
import StatsScreen from './screens/StatsScreen';
import SettingsScreen from './screens/SettingsScreen';
import LogScreen from './screens/LogScreen';
import TrainScreen from './screens/TrainScreen';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import { createChime } from './audio/chime';
import StaleBackupModal from './components/modals/StaleBackupModal';
import DiscardWorkoutModal from './components/modals/DiscardWorkoutModal';
import CSVImportModal from './components/modals/CSVImportModal';
import RestoreBackupModal from './components/modals/RestoreBackupModal';
import HelpSheet from './components/modals/HelpSheet';
import ResumeWorkoutModal from './components/modals/ResumeWorkoutModal';
import FailureDeloadModal from './components/modals/FailureDeloadModal';
import LongBreakDeloadModal from './components/modals/LongBreakDeloadModal';
import SyncConflictModal from './components/modals/SyncConflictModal';
import WorkoutPickerSheet from './components/modals/WorkoutPickerSheet';
import CompletionSummaryModal from './components/modals/CompletionSummaryModal';
import EditEntryModal from './components/modals/EditEntryModal';

const LONG_BREAK_DELOAD_KEY = 'strength5x5_long_break_deload_for_date';

const App = () => {
  const { t } = useTranslation();
  const saved = useLoadSaved();
  const { toasts, showToast } = useToast();

  const [weights, setWeights] = useState(saved.weights ?? INITIAL_WEIGHTS);
  const [program, setProgram] = useState(() => normalizeProgram(saved.program));
  const [history, setHistory] = useState(Array.isArray(saved.history) ? saved.history : []);
  const [currentWorkoutType, setCurrentWorkoutType] = useState(saved.nextType ?? 'A');
  const [preset, setPreset] = useState(() => normalizePreset(saved.preset));
  const [mcTop, setMcTop] = useState(() => normalizeMcTop(saved.mcTop, saved.weights ?? INITIAL_WEIGHTS));
  const [mcWeek, setMcWeek] = useState(() => normalizeMcWeek(saved.mcWeek));
  const [mcInterval, setMcInterval] = useState(() => normalizeMcInterval(saved.mcInterval));
  const [mcPress, setMcPress] = useState(() => normalizeMcPress(saved.mcPress));
  const [mcNextDay, setMcNextDay] = useState(() => normalizeMcNextDay(saved.mcNextDay));
  const [mcPending, setMcPending] = useState(() => normalizeMcPending(saved.mcPending));
  const [isDark, setIsDark] = useState(saved.isDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [localBackup, setLocalBackup] = useState(saved.autoSave ?? false);
  const [preferredRest, setPreferredRest] = useState(saved.preferredRest ?? 90);
  const [soundEnabled, setSoundEnabled] = useState(saved.soundEnabled ?? false);
  const [vibrationEnabled, setVibrationEnabled] = useState(saved.vibrationEnabled ?? saved.hapticsEnabled ?? false);

  const [activeTab, setActiveTab] = useState('workout');
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [deloadAlert, setDeloadAlert] = useState(null);
  const [deloadPercent, setDeloadPercent] = useState(10);
  const [pendingFailureDeloads, setPendingFailureDeloads] = useState(null);
  const [isExerciseComplete, setIsExerciseComplete] = useState(false);
  const [pendingCSVImport, setPendingCSVImport] = useState(null);
  const [statsView, setStatsView] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [logGrouping, setLogGrouping] = useState(saved.logGrouping ?? 'all');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedBarSetup, setExpandedBarSetup] = useState({});
  const [completionSummary, setCompletionSummary] = useState(null);
  const [showResumePrompt, setShowResumePrompt] = useState(() => !!saved.activeSession);
  const [pendingDriveRestore, setPendingDriveRestore] = useState(null);
  const [pendingLocalImport, setPendingLocalImport] = useState(null);
  const [connectSyncPrompt, setConnectSyncPrompt] = useState(null);
  const [longBreakDeloadForDate, setLongBreakDeloadForDate] = useState(() => localStorage.getItem(LONG_BREAK_DELOAD_KEY));
  const [repPicker, setRepPicker] = useState(null);
  const [programSheet, setProgramSheet] = useState(null); // { step: 'pick' | 'confirm', target }
  const [workoutPicker, setWorkoutPicker] = useState(false);
  const [guideLift, setGuideLift] = useState(null);

  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const chimeRef = useRef(null);
  if (!chimeRef.current) chimeRef.current = createChime();

  const gdrive = useGoogleDrive();

  useWakeLock();

  const timer = useTimer({
    onExpire: () => {
      if (soundEnabled) chimeRef.current.play();
      if (vibrationEnabled && navigator?.vibrate) { navigator.vibrate([200, 100, 200]); }
    }
  });

  useSyncStorage({
    weights, program, history, nextType: currentWorkoutType,
    isDark, autoSave: localBackup, preferredRest, soundEnabled, vibrationEnabled, logGrouping,
    preset, mcTop, mcWeek, mcInterval, mcPress, mcNextDay, mcPending,
  });

  useStorageSync(STORAGE_KEY, (updated) => {
    if (updated.weights) setWeights(updated.weights);
    if (updated.program) setProgram(normalizeProgram(updated.program));
    if (Array.isArray(updated.history)) setHistory(updated.history);
    if (updated.isDark !== undefined) setIsDark(updated.isDark);
    if (updated.preset) setPreset(normalizePreset(updated.preset));
    if (updated.mcTop) setMcTop(normalizeMcTop(updated.mcTop, updated.weights ?? weights));
    if (updated.mcWeek) setMcWeek(normalizeMcWeek(updated.mcWeek));
    if (updated.mcInterval) setMcInterval(normalizeMcInterval(updated.mcInterval));
    if (updated.mcPress) setMcPress(normalizeMcPress(updated.mcPress));
    if (updated.mcNextDay) setMcNextDay(normalizeMcNextDay(updated.mcNextDay));
    if (updated.mcPending !== undefined) setMcPending(normalizeMcPending(updated.mcPending));
  });

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--app-page-bg', isDark ? '#161826' : '#f5f5f8');
  }, [isDark]);

  useEffect(() => {
    if (!currentWorkout || !isWorkoutActive) return;
    const data = { session: currentWorkout, restTimerEndTime: timer.isActive ? (Date.now() + timer.seconds * 1000) : null };
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(data));
  }, [currentWorkout, isWorkoutActive, timer.isActive, timer.seconds]);

  const big3Total = useMemo(() => (weights?.squat || 0) + (weights?.bench || 0) + (weights?.deadlift || 0), [weights]);

  const best1RMs = useMemo(() => {
    const result = {};
    for (const id of [...EXPECTED_WEIGHT_KEYS, 'incline']) {
      result[id] = calculateBest1RM(history, id);
    }
    return result;
  }, [history]);

  const historyDateSet = useMemo(() => new Set(history.map(s => s.date.slice(0, 10))), [history]);
  const trainedToday = historyDateSet.has(new Date().toISOString().slice(0, 10));

  const getAppState = useCallback(() => ({
    weights, program, history, nextType: currentWorkoutType, isDark, autoSave: localBackup, preferredRest, soundEnabled, vibrationEnabled, logGrouping, language: i18n.language,
    preset, mcTop, mcWeek, mcInterval, mcPress, mcNextDay, mcPending,
  }), [weights, program, history, currentWorkoutType, isDark, localBackup, preferredRest, soundEnabled, vibrationEnabled, logGrouping, preset, mcTop, mcWeek, mcInterval, mcPress, mcNextDay, mcPending]);

  const exportData = useCallback((targetHistory) => {
    const data = { app: 'Strength 5x5', version: SCHEMA_VERSION, ...getAppState(), history: targetHistory || history };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `strength5x5_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [getAppState, history]);

  const saveToDriveQuietly = useCallback(async (state) => {
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID || !gdrive.hasEverConnected) return;
    const result = await gdrive.save(state);
    if (!result.success && result.error !== 'cancelled') {
      showToast(t('toast.driveSaveFailed'), 'error');
    }
  }, [gdrive, showToast, t]);


  const handleUpdateActiveWeight = useCallback((exIdx, nextWeight) => {
    setCurrentWorkout(prev => prev ? ({ ...prev, exercises: prev.exercises.map((e, i) => i !== exIdx ? e : ({ ...e, weight: Math.max(0, nextWeight) })) }) : null);
  }, []);

  // Idle-screen input adjusts `weights` directly (there's no active workout yet),
  // floored at the empty 20kg bar rather than active-session's 0.
  const handleUpdateIdleWeight = useCallback((id, nextWeight) => {
    setWeights(prev => ({ ...prev, [id]: Math.max(20, nextWeight) }));
  }, []);

  // Shared by the short-press cycle and the long-press rep picker: given the current
  // logged value, resolveNext computes the next one, then this stamps setTimes and
  // drives the rest timer identically either way.
  const applySetValue = useCallback((exIdx, setIdx, resolveNext) => {
    if (timer.isExpired) timer.reset();
    setCurrentWorkout(prev => {
      if (!prev) return prev;
      const ex = prev.exercises[exIdx];
      const currVal = ex.setsCompleted[setIdx];
      const target = targetReps(ex, setIdx);
      const nextVal = resolveNext(currVal, target);
      const isLastSet = setIdx === ex.setsCompleted.length - 1;
      // Stamp on first completion, clear when the set is cycled back to unlogged.
      // Rep adjustments in between keep the original time — the set finished when it finished.
      const stampChanged = currVal === null || nextVal === null;
      const nextStamp = currVal === null ? Date.now() : null;
      const nextWorkout = { ...prev, exercises: prev.exercises.map((e, i) => i !== exIdx ? e : ({
        ...e,
        setsCompleted: e.setsCompleted.map((r, j) => j === setIdx ? nextVal : r),
        setTimes: (e.setTimes ?? new Array(e.setsCompleted.length).fill(null)).map((at, j) => j === setIdx && stampChanged ? nextStamp : at),
      })) };

      if (nextVal !== null) {
        if (isLastSet) {
          timer.stop();
          const allDone = nextWorkout.exercises.every(e => e.setsCompleted.every(s => s !== null));
          setIsExerciseComplete(allDone ? 'workout' : true);
        } else {
          setIsExerciseComplete(false);
          const req = Array.isArray(ex.restSeconds)
            ? (ex.restSeconds[setIdx + 1] ?? preferredRest)
            : (nextVal === target ? preferredRest : 300);
          timer.start(req);
        }
      } else { timer.stop(); setIsExerciseComplete(false); }
      return nextWorkout;
    });
  }, [timer, preferredRest]);

  const handleToggleSet = useCallback((exIdx, setIdx) => {
    // Short-press cycle: unlogged -> target -> target-1 -> ... -> 1 -> 0 -> unlogged.
    applySetValue(exIdx, setIdx, (currVal, target) => currVal === null ? target : currVal > 0 ? currVal - 1 : null);
  }, [applySetValue]);

  const handleOpenRepPicker = useCallback((exIdx, setIdx) => {
    const ex = currentWorkout?.exercises[exIdx];
    if (!ex) return;
    setRepPicker({ exIdx, setIdx, ex });
  }, [currentWorkout]);

  const handleSetReps = useCallback((value) => {
    if (!repPicker) return;
    applySetValue(repPicker.exIdx, repPicker.setIdx, () => value);
    setRepPicker(null);
  }, [repPicker, applySetValue]);

  const finishWorkout = useCallback(() => {
    const isMadcow = getProgram(preset).ramped;
    const savedWorkout = {
      ...currentWorkout,
      preset,
      duration: Date.now() - (currentWorkout.startedAt || Date.now()),
      exercises: calculateSetDurations(currentWorkout.exercises, currentWorkout.startedAt),
    };
    delete savedWorkout.startedAt;
    const newHistory = [savedWorkout, ...history];

    let nextWeights = weights;
    let nextType = currentWorkoutType;
    let nextMcTop = mcTop;
    let nextMcWeek = mcWeek;
    let nextMcNextDay = mcNextDay;
    let nextMcPending = mcPending;
    let progressions, pendingDeloads, summaryNextValues;

    if (isMadcow) {
      const outcome = evaluateMadcowOutcome(currentWorkout.type, currentWorkout.exercises, mcTop, mcWeek, mcPending, MADCOW_ONRAMP_WEEKS);
      nextMcTop = outcome.nextTop;
      nextMcWeek = outcome.nextWeek;
      nextMcPending = outcome.nextPending;
      nextWeights = applyMcTopToWeights(weights, nextMcTop);
      nextMcNextDay = MADCOW_DAYS[(MADCOW_DAYS.indexOf(currentWorkout.type) + 1) % MADCOW_DAYS.length];
      progressions = outcome.progressions;
      pendingDeloads = [];
      summaryNextValues = outcome.projectedTop;
      setMcTop(nextMcTop); setMcWeek(nextMcWeek); setMcNextDay(nextMcNextDay); setMcPending(nextMcPending); setWeights(nextWeights);
    } else {
      const outcome = evaluateWorkoutOutcome(currentWorkout, history, weights);
      nextWeights = outcome.nextWeights;
      nextType = currentWorkoutType === 'A' ? 'B' : 'A';
      progressions = outcome.progressions;
      pendingDeloads = outcome.pendingDeloads;
      summaryNextValues = nextWeights;
      setWeights(nextWeights); setCurrentWorkoutType(nextType);
    }

    setHistory(newHistory);
    setIsWorkoutActive(false); setCurrentWorkout(null);
    timer.reset(); setIsExerciseComplete(false);
    setCompletionSummary({ workout: savedWorkout, progressions, pendingDeloads, nextWeights: summaryNextValues });
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
    if (localBackup) exportData(newHistory);

    saveToDriveQuietly({
      weights: nextWeights, program, history: newHistory, nextType,
      isDark, autoSave: localBackup, preferredRest, soundEnabled, vibrationEnabled, logGrouping,
      preset, mcTop: nextMcTop, mcWeek: nextMcWeek, mcInterval, mcPress, mcNextDay: nextMcNextDay, mcPending: nextMcPending,
    });
  }, [currentWorkout, history, weights, program, localBackup, exportData, timer, currentWorkoutType, isDark, preferredRest, soundEnabled, vibrationEnabled, logGrouping, saveToDriveQuietly, preset, mcTop, mcWeek, mcInterval, mcPress, mcNextDay, mcPending]);

  const cancelWorkout = useCallback(() => {
    setIsWorkoutActive(false); setCurrentWorkout(null);
    timer.reset(); setIsExerciseComplete(false); setShowCancelModal(false);
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
  }, [timer]);

  const initializeWorkout = useCallback((workoutWeights) => {
    const prog = getProgram(preset);
    const day = getCurrentDay(prog.id);
    const exercises = prog.dayExercises(day, { program, weights: workoutWeights, mcTop, mcInterval, mcPress })
      .map(ex => ({ ...ex, setsCompleted: new Array(ex.sets).fill(null), setTimes: new Array(ex.sets).fill(null) }));
    setCurrentWorkout({ date: new Date().toISOString(), type: day, startedAt: Date.now(), exercises });
    setIsWorkoutActive(true); setActiveTab('workout'); setShowRestorePrompt(false); setIsExerciseComplete(false);
  }, [currentWorkoutType, program, preset, mcNextDay, mcTop, mcInterval, mcPress]);

  const startWorkout = useCallback((force = false) => {
    if (history.length === 0 && !force) { setShowRestorePrompt(true); return; }
    const prompt = getStartDeloadPrompt(history, weights, { longBreakDeloadForDate, preset });
    if (prompt?.type === 'longBreak') {
      setDeloadPercent(prompt.recommended);
      setDeloadAlert({ daysOff: prompt.daysOff, recommended: prompt.recommended, message: t('modals.deloadMessage', { days: prompt.daysOff }) });
      return;
    }
    if (prompt?.type === 'failure') {
      setDeloadPercent(10);
      setPendingFailureDeloads(prompt.pendingDeloads);
      return;
    }
    initializeWorkout(weights);
  }, [history, weights, initializeWorkout, longBreakDeloadForDate, preset, t]);

  // Switches the active program, converting weights each direction so Stats and the
  // Program tab always agree with whatever's actually being trained.
  const switchProgram = useCallback((target) => {
    if (isWorkoutActive) cancelWorkout();
    if (target === 'madcow') {
      const seeded = seedMadcowTops(weights);
      setMcTop(seeded);
      setMcWeek(1);
      setMcNextDay('A');
      setMcPending([]);
      setWeights(prev => applyMcTopToWeights(prev, seeded));
    } else {
      setWeights(prev => madcowTopsToWeights(prev, mcTop, mcPress));
    }
    setPreset(target);
    setProgramSheet(null);
  }, [weights, mcTop, mcPress, isWorkoutActive, cancelWorkout]);

  // The one path every Madcow top-set edit goes through -- Program tab, Train's idle
  // row, and Train's active-workout card -- so mcTop, the mirrored `weights`, and (if
  // that lift is mid-session) its live ramp never drift apart. Each setter reads its
  // own fresh `prev` rather than closing over mcTop/weights/currentWorkout, so this
  // stays correct even if two taps land before a render lands between them.
  const updateMcTop = useCallback((liftId, nextTop) => {
    const clamped = clampMcTop(liftId, nextTop);
    setMcTop(prev => ({ ...prev, [liftId]: clamped }));
    setWeights(prev => applyMcTopToWeights(prev, { [liftId]: clamped }));
    setCurrentWorkout(prev => reviseWorkoutTopSet(prev, liftId, clamped, mcInterval));
  }, [mcInterval]);

  const applyLocalImport = useCallback((d) => {
    hydrateFromBackup(d, {
      setWeights, setProgram, setHistory, setCurrentWorkoutType, setIsDark, setLocalBackup,
      setPreferredRest, setSoundEnabled, setVibrationEnabled, setLogGrouping,
      setPreset, setMcTop, setMcWeek, setMcInterval, setMcPress, setMcNextDay, setMcPending,
    });
    setActiveTab('workout'); setShowRestorePrompt(false);
    setPendingLocalImport(null);
    showToast(t('toast.backupRestored'), 'success');
    saveToDriveQuietly({
      weights: d.weights, program: normalizeProgram(d.program), history: d.history, nextType: d.nextType || currentWorkoutType,
      isDark: d.isDark ?? true, autoSave: d.autoSave ?? false,
      preferredRest: d.preferredRest || preferredRest,
      soundEnabled: d.soundEnabled ?? soundEnabled,
      vibrationEnabled: d.vibrationEnabled ?? vibrationEnabled,
      logGrouping: d.logGrouping || logGrouping,
      language: d.language || i18n.language,
      preset: normalizePreset(d.preset), mcTop: normalizeMcTop(d.mcTop, d.weights), mcWeek: normalizeMcWeek(d.mcWeek),
      mcInterval: normalizeMcInterval(d.mcInterval), mcPress: normalizeMcPress(d.mcPress), mcNextDay: normalizeMcNextDay(d.mcNextDay),
      mcPending: normalizeMcPending(d.mcPending),
    });
  }, [currentWorkoutType, preferredRest, soundEnabled, vibrationEnabled, logGrouping, saveToDriveQuietly, showToast, t]);

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_SIZE) {
      console.warn('Import rejected: file exceeds 5MB limit');
      showToast(t('toast.fileTooLarge'), 'error');
      return;
    }
    readBackupFile(file).then((d) => {
      const importCount = d.history?.length || 0;
      const localCount = history.length;

      if (localCount > 0 && importCount < localCount) {
        const latestImport = d.history.reduce((latest, s) => {
          const dt = new Date(s.date);
          return dt > latest ? dt : latest;
        }, new Date(d.history[0].date));
        setPendingLocalImport({
          data: d,
          backupCount: importCount,
          backupDate: latestImport.toLocaleDateString(),
          localCount,
          lossCount: Math.max(0, localCount - importCount),
        });
        return;
      }

      applyLocalImport(d);
    }).catch((err) => {
      showToast(t('toast.' + (err.code === 'invalidBackup' ? 'invalidBackup' : 'couldNotRead')), 'error');
    });
    e.target.value = '';
  };

  const handleStrongliftsImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_SIZE) {
      console.warn('Import rejected: file exceeds 5MB limit');
      showToast(t('toast.fileTooLarge'), 'error');
      return;
    }
    readStrongliftsFile(file).then((result) => {
      setPendingCSVImport(result);
    }).catch((err) => {
      showToast(t('toast.' + (err.code === 'noValidWorkouts' ? 'noValidWorkouts' : 'couldNotReadCSV')), 'error');
    });
    e.target.value = '';
  };

  const applyCSVImport = useCallback(() => {
    if (!pendingCSVImport) return;
    const count = pendingCSVImport.history.length;
    setWeights(pendingCSVImport.weights);
    setHistory(pendingCSVImport.history);
    setCurrentWorkoutType(pendingCSVImport.nextType);
    setPendingCSVImport(null);
    setShowRestorePrompt(false);
    setActiveTab('workout');
    showToast(t('toast.importedWorkouts', { count }), 'success');
    saveToDriveQuietly({
      ...getAppState(),
      weights: pendingCSVImport.weights,
      history: pendingCSVImport.history,
      nextType: pendingCSVImport.nextType,
    });
  }, [pendingCSVImport, showToast, getAppState, saveToDriveQuietly]);

  const applyDriveRestore = useCallback((d) => {
    hydrateFromBackup(d, {
      setWeights, setProgram, setHistory, setCurrentWorkoutType, setIsDark, setLocalBackup,
      setPreferredRest, setSoundEnabled, setVibrationEnabled, setLogGrouping,
      setPreset, setMcTop, setMcWeek, setMcInterval, setMcPress, setMcNextDay, setMcPending,
    });
    setActiveTab('workout');
    showToast(t('toast.restoredFromDrive'), 'success');
  }, [showToast, t]);

  const handleDriveSave = useCallback(async () => {
    const result = await gdrive.save(getAppState());
    if (result.success) {
      showToast(t('toast.savedToDrive'), 'success');
    } else if (result.error === 'fileTooLarge') {
      showToast(t('toast.driveFileTooLarge'), 'error');
    } else if (result.error !== 'cancelled') {
      showToast(t('toast.' + result.error), 'error');
    }
  }, [gdrive, getAppState, showToast, t]);

  const handleDriveRestore = useCallback(async () => {
    const result = await gdrive.restore(history);
    if (!result.success) {
      if (result.error !== 'cancelled') showToast(t('toast.' + result.error), 'error');
      return;
    }
    if (result.stale) {
      const backupCount = result.data.history?.length || 0;
      const localCount = history.length;
      setPendingDriveRestore({
        data: result.data,
        backupDate: result.cloudDate,
        localCount,
        backupCount,
        lossCount: Math.max(0, localCount - backupCount),
      });
    } else {
      applyDriveRestore(result.data);
    }
  }, [gdrive, history, applyDriveRestore, showToast, t]);

  const handleConnect = useCallback(async () => {
    const connected = await gdrive.connect();
    if (!connected) return;

    const backup = await gdrive.checkBackup();
    const hasLocal = history.length > 0;

    if (!backup.exists && !hasLocal) return;

    if (!backup.exists && hasLocal) {
      const result = await gdrive.save(getAppState());
      if (result.success) showToast(t('toast.driveAutoSaved'), 'success');
      return;
    }

    if (backup.exists && !hasLocal) {
      const result = await gdrive.restore(history);
      if (result.success) {
        applyDriveRestore(result.data);
        showToast(t('toast.driveAutoRestored'), 'success');
      }
      return;
    }

    const latestLocal = history.reduce((latest, s) => {
      const d = new Date(s.date);
      return d > latest ? d : latest;
    }, new Date(history[0].date));

    const result = await gdrive.restore(history);
    const driveCount = result.success ? (result.data.history?.length || 0) : 0;

    if (backup.modifiedTime > latestLocal || latestLocal > backup.modifiedTime) {
      setConnectSyncPrompt({
        driveData: result.success ? result.data : null,
        cloudDate: backup.modifiedTime.toLocaleDateString(),
        localDate: latestLocal.toLocaleDateString(),
        driveCount,
        localCount: history.length,
      });
    }
  }, [gdrive, history, getAppState, applyDriveRestore, showToast, t]);

  const handleManualLogSave = useCallback((overrides) => {
    const nextState = { ...getAppState(), ...overrides };
    saveToDriveQuietly(nextState);
  }, [getAppState, saveToDriveQuietly]);

  const formatLastSaved = useCallback((date) => {
    if (!date) return null;
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Today, ${time}` : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
  }, []);

  const liveWorkoutVisible = isWorkoutActive && currentWorkout && activeTab !== 'workout';
  const isMidWorkout = isWorkoutActive && activeTab === 'workout';
  const timerVisible = isMidWorkout;

  const handleTabClick = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  const handleTimerSkip = useCallback(() => {
    chimeRef.current.resume();
    if (isExerciseComplete) {
      timer.reset();
      setIsExerciseComplete(false);
    } else {
      timer.skip();
    }
  }, [timer, isExerciseComplete]);

  const driveConfigured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const workoutStats = getWorkoutStats(history);
  const moodLabel = (day) => {
    const mood = getProgram(preset).dayMood(day);
    return mood ? t('program.madcow.mood' + mood.charAt(0).toUpperCase() + mood.slice(1)) : null;
  };
  // Where "today's workout" points for whichever program is active -- each program keeps
  // its own pointer (Standard flips A/B on finish, Madcow advances mcNextDay weekly).
  const getCurrentDay = (progId) => (progId === 'madcow' ? mcNextDay : currentWorkoutType);
  const setCurrentDay = (progId, day) => { if (progId === 'madcow') setMcNextDay(day); else setCurrentWorkoutType(day); };

  return (
    <div className={`h-viewport max-w-md mx-auto flex flex-col font-sans transition-colors duration-300 bg-ground text-ink`}>

      {!isMidWorkout && (
        <header className="flex-none header-safe px-5 pb-2.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Barbell weight="fill" size={20} className="text-accent" />
            <h1 className="text-[17px] font-semibold">{t('app.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Flame size={15} weight="fill" className="text-accent" />
              <span className={`text-[12.5px] text-ink/55`}>{t('header.streak', { count: workoutStats.streak })}</span>
            </div>
            <button
              onClick={() => setShowHelp(true)}
              aria-label="How it works"
              className={`w-9 h-9 rounded-lg border flex items-center justify-center border-ink/15 text-ink`}
            ><Question size={18} /></button>
          </div>
        </header>
      )}

      {timerVisible && (
        <RestTimer
          seconds={timer.seconds} total={timer.duration}
          isExerciseComplete={isExerciseComplete} isExpired={timer.isExpired} isActive={timer.isActive}
          onSkip={handleTimerSkip} elapsed={timer.elapsed}
          startedAt={currentWorkout?.startedAt} workoutType={currentWorkout?.type}
        />
      )}

      <main className="flex-1 min-h-0 px-4 py-4 overflow-y-auto overscroll-contain">
        {activeTab === 'workout' && (
          <TrainScreen
            isWorkoutActive={isWorkoutActive} preset={preset} getCurrentDay={getCurrentDay}
            program={program} weights={weights} mcTop={mcTop} mcInterval={mcInterval} mcPress={mcPress} mcWeek={mcWeek}
            moodLabel={moodLabel} expandedBarSetup={expandedBarSetup} setExpandedBarSetup={setExpandedBarSetup}
            setWorkoutPicker={setWorkoutPicker} updateMcTop={updateMcTop} handleUpdateIdleWeight={handleUpdateIdleWeight}
            setGuideLift={setGuideLift} startWorkout={startWorkout} trainedToday={trainedToday} workoutStats={workoutStats}
            currentWorkout={currentWorkout} handleToggleSet={handleToggleSet} handleOpenRepPicker={handleOpenRepPicker}
            handleUpdateActiveWeight={handleUpdateActiveWeight} finishWorkout={finishWorkout} setShowCancelModal={setShowCancelModal}
          />
        )}

        {activeTab === 'history' && (
          <LogScreen
            history={history} preset={preset} program={program} weights={weights}
            mcTop={mcTop} mcInterval={mcInterval} mcPress={mcPress}
            getCurrentDay={getCurrentDay} setEditingEntry={setEditingEntry}
            logGrouping={logGrouping} setLogGrouping={setLogGrouping}
            expandedGroups={expandedGroups} setExpandedGroups={setExpandedGroups}
          />
        )}

        {activeTab === 'progress' && (
          <StatsScreen
            history={history} statsView={statsView} setStatsView={setStatsView}
            weights={weights} best1RMs={best1RMs} big3Total={big3Total}
            preset={preset} program={program} mcTop={mcTop} mcInterval={mcInterval} mcPress={mcPress}
          />
        )}

        {activeTab === 'program' && (
          <ProgramScreen
            isWorkoutActive={isWorkoutActive} preset={preset}
            program={program} onChangeProgram={setProgram} weights={weights} history={history}
            mcTop={mcTop} mcWeek={mcWeek} mcInterval={mcInterval} mcPress={mcPress}
            onUpdateMcTop={updateMcTop} onChangeMcInterval={setMcInterval} onChangeMcPress={setMcPress}
            onRecalculate={() => setMcInterval(MADCOW_DEFAULT_INTERVAL)}
            currentWorkoutType={currentWorkoutType} mcNextDay={mcNextDay}
            programSheet={programSheet} setProgramSheet={setProgramSheet} onSwitchProgram={switchProgram}
            onOpenGuide={setGuideLift}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            preferredRest={preferredRest} setPreferredRest={setPreferredRest}
            soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled}
            vibrationEnabled={vibrationEnabled} setVibrationEnabled={setVibrationEnabled}
            isDark={isDark} setIsDark={setIsDark}
            localBackup={localBackup} setLocalBackup={setLocalBackup}
            driveConfigured={driveConfigured} gdrive={gdrive}
            handleConnect={handleConnect} handleDriveSave={handleDriveSave}
            formatLastSaved={formatLastSaved} exportData={exportData}
            fileInputRef={fileInputRef} csvInputRef={csvInputRef}
          />
        )}
      </main>

      {liveWorkoutVisible && (() => {
        const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
        const liveDetail = timer.isExpired
          ? t('liveWorkout.lifting', { time: formatTime(timer.elapsed) })
          : timer.isActive
            ? t('liveWorkout.resting', { time: formatTime(timer.seconds) })
            : t('liveWorkout.activeWorkout');
        return (
          <div className="flex-none px-3 py-1.5">
            <button onClick={() => handleTabClick('workout')} className="w-full h-10 px-4 rounded-[9px] border border-accent bg-accent-900 text-accent-300 flex items-center justify-between">
              <span className="flex items-center gap-2 text-body tabular-nums">
                <Play size={13} weight="fill" />
                {liveDetail}
              </span>
              <span className="flex items-center gap-1 text-body">
                {t('liveWorkout.return')} <CaretRight size={12} />
              </span>
            </button>
          </div>
        );
      })()}

      <nav className={`flex-none border-t flex justify-between px-2 pt-1.5 nav-safe bg-surface-nav border-ink/8`}>
        {[
          { id: 'workout', label: t('tabs.train'), icon: Barbell },
          { id: 'program', label: t('tabs.program'), icon: SlidersHorizontal },
          { id: 'history', label: t('tabs.log'), icon: ListChecks },
          { id: 'progress', label: t('tabs.stats'), icon: ChartLineUp },
          { id: 'settings', label: t('tabs.options'), icon: Gear },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const colorClass = isActive ? 'text-accent-300' : ('text-ink/35');
          return (
            <button key={tab.id} onClick={() => handleTabClick(tab.id)} aria-label={tab.label} className={`flex-1 flex flex-col items-center gap-1 py-1.5 px-2.5 transition-all active:scale-95 ${colorClass}`}>
              <tab.icon size={23} weight={isActive ? 'fill' : 'regular'} />
              <span className="text-tab">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {showCancelModal && (
        <DiscardWorkoutModal
          onKeepLifting={() => setShowCancelModal(false)}
          onDiscard={cancelWorkout}
        />
      )}

      {deloadAlert && (
        <LongBreakDeloadModal
          deloadAlert={deloadAlert}
          deloadPercent={deloadPercent}
          onDeloadPercentChange={setDeloadPercent}
          weights={weights}
          onAccept={(newW) => {
            const lastWorkoutDate = history[0]?.date;
            if (lastWorkoutDate) {
              setLongBreakDeloadForDate(lastWorkoutDate);
              localStorage.setItem(LONG_BREAK_DELOAD_KEY, lastWorkoutDate);
            }
            setWeights(newW);
            initializeWorkout(newW);
            setDeloadAlert(null);
          }}
          onSkip={() => { initializeWorkout(weights); setDeloadAlert(null); }}
        />
      )}

      {showRestorePrompt && (
        <RestoreBackupModal
          driveConfigured={driveConfigured}
          onRestoreFile={() => fileInputRef.current?.click()}
          onConnectDrive={handleConnect}
          onImportCSV={() => csvInputRef.current?.click()}
          onSkip={() => startWorkout(true)}
        />
      )}

      {showResumePrompt && saved.activeSession && (
        <ResumeWorkoutModal
          activeSession={saved.activeSession}
          onResume={() => {
            const active = saved.activeSession;
            setCurrentWorkout(active.session);
            setIsWorkoutActive(true);
            setActiveTab('workout');
            if (active.restTimerEndTime) {
              const remaining = Math.ceil((active.restTimerEndTime - Date.now()) / 1000);
              if (remaining > 0) {
                timer.start(remaining);
              } else {
                timer.skip();
              }
            }
            setShowResumePrompt(false);
          }}
          onDiscard={() => {
            localStorage.removeItem(ACTIVE_WORKOUT_KEY);
            setShowResumePrompt(false);
          }}
        />
      )}

      {repPicker && (
        <RepPicker
          ex={repPicker.ex}
          setIdx={repPicker.setIdx}
          onSelect={handleSetReps}
          onClose={() => setRepPicker(null)}
        />
      )}

      {workoutPicker && (
        <WorkoutPickerSheet
          preset={preset}
          program={program}
          weights={weights}
          mcTop={mcTop}
          mcInterval={mcInterval}
          mcPress={mcPress}
          currentDay={getCurrentDay(getProgram(preset).id)}
          moodLabel={moodLabel}
          onSelectDay={(day) => { setCurrentDay(getProgram(preset).id, day); setWorkoutPicker(false); }}
          onClose={() => setWorkoutPicker(false)}
        />
      )}

      {pendingCSVImport && (
        <CSVImportModal
          pendingCSVImport={pendingCSVImport}
          onImport={applyCSVImport}
          onCancel={() => setPendingCSVImport(null)}
        />
      )}

      {editingEntry && (
        <EditEntryModal
          editingEntry={editingEntry}
          setEditingEntry={setEditingEntry}
          history={history}
          historyDateSet={historyDateSet}
          preset={preset}
          currentWorkoutType={currentWorkoutType}
          weights={weights}
          program={program}
          mcTop={mcTop}
          mcInterval={mcInterval}
          mcPress={mcPress}
          setWeights={setWeights}
          setCurrentWorkoutType={setCurrentWorkoutType}
          setHistory={setHistory}
          showToast={showToast}
          handleManualLogSave={handleManualLogSave}
          saveToDriveQuietly={saveToDriveQuietly}
          getAppState={getAppState}
        />
      )}

      {completionSummary && (
        <CompletionSummaryModal
          completionSummary={completionSummary}
          onDone={() => setCompletionSummary(null)}
        />
      )}

      {pendingFailureDeloads && (
        <FailureDeloadModal
          pendingFailureDeloads={pendingFailureDeloads}
          deloadPercent={deloadPercent}
          onDeloadPercentChange={setDeloadPercent}
          onConfirm={(previewDeloads) => {
            const updatedWeights = { ...weights };
            previewDeloads.forEach(d => { updatedWeights[d.id] = d.newWeight; });
            setWeights(updatedWeights);
            setPendingFailureDeloads(null);
            initializeWorkout(updatedWeights);
          }}
          onSkip={() => {
            setPendingFailureDeloads(null);
            initializeWorkout(weights);
          }}
        />
      )}

      {showHelp && (
        <HelpSheet
          preset={preset}
          onOpenProgram={() => { setShowHelp(false); setActiveTab('program'); }}
          onClose={() => setShowHelp(false)}
        />
      )}

      {guideLift && (
        <ExerciseGuideSheet liftId={guideLift} onClose={() => setGuideLift(null)} />
      )}

      {pendingDriveRestore && (
        <StaleBackupModal
          backupCount={pendingDriveRestore.backupCount}
          backupDate={pendingDriveRestore.backupDate}
          localCount={pendingDriveRestore.localCount}
          lossCount={pendingDriveRestore.lossCount}
          onRestoreAnyway={() => { applyDriveRestore(pendingDriveRestore.data); setPendingDriveRestore(null); }}
          onCancel={() => setPendingDriveRestore(null)}
        />
      )}

      {pendingLocalImport && (
        <StaleBackupModal
          backupCount={pendingLocalImport.backupCount}
          backupDate={pendingLocalImport.backupDate}
          localCount={pendingLocalImport.localCount}
          lossCount={pendingLocalImport.lossCount}
          onRestoreAnyway={() => applyLocalImport(pendingLocalImport.data)}
          onCancel={() => setPendingLocalImport(null)}
        />
      )}

      {connectSyncPrompt && (
        <SyncConflictModal
          connectSyncPrompt={connectSyncPrompt}
          onUseDriveData={async () => {
            if (connectSyncPrompt.driveData) {
              applyDriveRestore(connectSyncPrompt.driveData);
              showToast(t('toast.restoredFromDrive'), 'success');
            }
            setConnectSyncPrompt(null);
          }}
          onUseLocalData={async () => {
            const result = await gdrive.save(getAppState());
            if (result.success) showToast(t('toast.savedToDrive'), 'success');
            setConnectSyncPrompt(null);
          }}
          onCancel={() => setConnectSyncPrompt(null)}
        />
      )}

      <Toast toasts={toasts} />
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
      <input type="file" ref={csvInputRef} onChange={handleStrongliftsImport} accept=".csv" className="hidden" />
    </div>
  );
};

export default App;
