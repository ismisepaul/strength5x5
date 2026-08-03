import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Barbell, ListChecks, Gear, Play, TrendUp,
  Plus, DownloadSimple, UploadSimple,
  Question, TrendDown,
  CaretRight,
  FileCsv, ArrowRight, Flame, CaretDown,
  SlidersHorizontal, ChartLineUp, Info
} from '@phosphor-icons/react';

import { useTranslation } from 'react-i18next';
import i18n from './i18n/index.js';
import { INITIAL_WEIGHTS, STORAGE_KEY, SCHEMA_VERSION, EXPECTED_WEIGHT_KEYS, MAX_IMPORT_SIZE, ACTIVE_WORKOUT_KEY, MADCOW_DAYS, MADCOW_ONRAMP_WEEKS, MADCOW_DEFAULT_INTERVAL } from './constants';
import { calculateBest1RM, formatDuration, calculateSetDurations, normalizeProgram, targetReps, normalizePreset, normalizeMcTop, normalizeMcWeek, normalizeMcInterval, normalizeMcPress, normalizeMcNextDay, normalizeMcPending, seedMadcowTops, madcowTopsToWeights, applyMcTopToWeights, evaluateMadcowOutcome } from './utils';
import { clampMcTop, reviseWorkoutTopSet } from './madcow';
import { evaluateWorkoutOutcome, getStartDeloadPrompt } from './progression';
import { hydrateFromBackup, readBackupFile, readStrongliftsFile } from './backup';
import { getProgram, PROGRAM_IDS, programAllLiftIds, topWeightOf } from './programs';
import { getExerciseTrend, getBig3Trend, getWorkoutStats, groupHistory } from './utils/chartData';
import { useLoadSaved, useSyncStorage, useStorageSync } from './hooks/useLocalStorage';
import { useTimer } from './hooks/useTimer';
import { useWakeLock } from './hooks/useWakeLock';
import RestTimer from './components/RestTimer';
import ExerciseCard from './components/ExerciseCard';
import BarSetupDiagram from './components/BarSetupDiagram';
import RepPicker from './components/RepPicker';
import ProgramTab from './components/ProgramTab';
import ExerciseGuideSheet from './components/ExerciseGuideSheet';
import StatsChart from './components/StatsChart';
import Toast from './components/Toast';
import WeightInput from './components/WeightInput';
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
          <div className="space-y-4">
            {!isWorkoutActive ? (
              <div>
                {(() => {
                  const prog = getProgram(preset);
                  const isMadcow = prog.ramped;
                  const day = getCurrentDay(prog.id);
                  const programState = { program, weights, mcTop, mcInterval, mcPress };
                  const liftIds = prog.liftIds(day, programState);
                  const dayExercises = prog.dayExercises(day, programState);
                  return (
                    <>
                      <div className="mb-4">
                        <p className="text-kicker font-semibold uppercase tracking-[0.14em] text-accent mb-1">{isMadcow ? t('workout.madcowKicker', { week: mcWeek }) : t('workout.standardKicker')}</p>
                        <div className="flex items-center gap-[10px]">
                          <h2 className="text-hero font-medium leading-tight">{t(`workout.type${day}`)}</h2>
                          <button
                            onClick={() => setWorkoutPicker(true)}
                            aria-label={t('workout.chooseWorkoutAria')}
                            className={`w-[38px] h-[38px] rounded-lg border flex items-center justify-center shrink-0 border-ink/18 text-ink`}
                          ><CaretDown size={16} /></button>
                        </div>
                        <p className={`text-body mt-1 text-ink/45`}>
                          {isMadcow
                            ? t('workout.madcowSubtitle', { mood: moodLabel(day), lifts: liftIds.map(id => t('exercises.' + id)).join(' · ') })
                            : liftIds.map(id => t('exercises.' + id)).join(' · ')}
                        </p>
                      </div>
                      <div className="mb-8">{dayExercises.map((ex, i) => {
                        const liftId = liftIds[i];
                        const exName = t('exercises.' + liftId);
                        const isBarSetupOpen = !!expandedBarSetup[liftId];
                        const topWeight = topWeightOf(ex);
                        return (
                        <div key={liftId} className={`py-[15px] rule-fade`}>
                          <div className={`flex justify-between ${isMadcow ? 'items-start' : 'items-center'}`}>
                            <button
                              onClick={() => setExpandedBarSetup(prev => ({ ...prev, [liftId]: !prev[liftId] }))}
                              aria-expanded={isBarSetupOpen}
                              className="flex flex-col items-start min-h-[44px] text-left flex-1 min-w-0 pr-3"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-[16px] font-medium truncate">{exName}</p>
                                <CaretDown size={12} weight="bold" className={`shrink-0 opacity-35 transition-transform ${isBarSetupOpen ? 'rotate-180' : ''}`} />
                              </div>
                              <p className={`text-[12.5px] text-ink/45`}>
                                {isMadcow ? (day === 'C' ? t('workout.dayCMeta') : t('workout.rampSetsMeta', { sets: ex.sets, from: Math.min(...ex.setWeights), to: topWeight })) : `${ex.sets} × ${ex.reps}`}
                              </p>
                            </button>
                            <WeightInput
                              value={isMadcow ? mcTop[liftId] : weights[liftId]}
                              increment={ex.increment}
                              min={isMadcow ? (INITIAL_WEIGHTS[liftId] ?? 20) : 20}
                              onChange={(next) => isMadcow ? updateMcTop(liftId, next) : handleUpdateIdleWeight(liftId, next)}
                              label={exName}
                              variant="prominent"
                              topSet={isMadcow}
                            />
                          </div>
                          {isBarSetupOpen && (
                            <div className={`mt-3 rounded-[9px] p-3.5 bg-surface/70`}>
                              <BarSetupDiagram weight={topWeight} />
                              <button
                                onClick={() => setGuideLift(liftId)}
                                aria-label={t('technique.openAria', { exercise: exName })}
                                className="flex items-center gap-1 min-h-9 mt-3 text-[12.5px] font-medium text-accent-300"
                              ><Info size={13} /> {t('technique.open')}</button>
                            </div>
                          )}
                        </div>
                        );
                      })}</div>
                    </>
                  );
                })()}
                <button onClick={() => startWorkout()} disabled={trainedToday} className={`w-full h-[54px] rounded-lg border border-accent text-accent font-medium text-[16px] flex items-center justify-center gap-2 transition-opacity ${trainedToday ? 'opacity-35' : 'active:scale-[0.98]'}`}><Play size={18} weight="fill" /> {trainedToday ? t('workout.trainedToday') : t('workout.startWorkout')}</button>
                <p className={`text-meta text-center mt-3 text-ink/38`}>{trainedToday ? t('workout.alreadyTrained') : t('workout.weekProgress', { count: workoutStats.thisWeek })}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center mb-2"><h2 className={`text-kicker font-semibold uppercase tracking-[0.14em] text-ink/45`}>{currentWorkout ? t(`workout.type${currentWorkout.type}`) : ''}</h2></div>
                {(() => {
                  const anySetLogged = currentWorkout?.exercises.some(ex => ex.setsCompleted.some(s => s !== null));
                  return currentWorkout?.exercises.map((ex, exIdx) => (
                    <ExerciseCard
                      key={ex.id}
                      ex={ex}
                      exIdx={exIdx}
                      onToggleSet={handleToggleSet}
                      onOpenRepPicker={handleOpenRepPicker}
                      showHint={exIdx === 0 && !anySetLogged}
                      onWeightChange={(next) => handleUpdateActiveWeight(exIdx, next)}
                      topSetValue={mcTop[ex.id]}
                      topSetMin={INITIAL_WEIGHTS[ex.id] ?? 20}
                      onTopSetChange={(next) => updateMcTop(ex.id, next)}
                      onOpenGuide={() => setGuideLift(ex.id)}
                    />
                  ));
                })()}
                <div className="pt-4 flex flex-col items-center">
                  {(() => {
                    const allDone = currentWorkout?.exercises.every(ex => ex.setsCompleted.every(s => s !== null));
                    return (
                      <>
                        <button onClick={finishWorkout} disabled={!allDone} className={`w-full h-[52px] rounded-lg border font-medium text-[15.5px] ${allDone ? 'border-accent text-accent active:scale-[0.98]' : ('border-ink/12 text-ink/30')}`}>{t('workout.finishWorkout')}</button>
                        {!allDone && <p className={`text-meta text-center mt-3 text-ink/45`}>{t('workout.completeAllSets')}</p>}
                      </>
                    );
                  })()}
                  <button onClick={() => setShowCancelModal(true)} className={`mt-8 w-full min-h-[44px] flex items-center justify-center text-card text-ink/45`}>{t('workout.discardWorkout')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (() => {
          const mutedClass = 'text-ink/45';
          const renderEntry = (s, key, onClick) => (
            <button key={key} onClick={onClick} className={`w-full text-left p-4 rounded-[10px] border active:scale-[0.98] transition-transform bg-surface border-ink/8`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-kicker font-semibold uppercase tracking-[0.14em] text-accent">{t(getProgram(s.preset).nameKey)}</span>
                <span className={`text-body ${mutedClass}`}>{s.duration ? `${formatDuration(s.duration, t)} · ` : ''}{new Date(s.date).toLocaleDateString()}</span>
              </div>
              <p className="text-card font-semibold mb-3">{t(`workout.type${s.type}`)}</p>
              <div className="space-y-2">{s.exercises.map(ex => (
                <div key={ex.id} className="flex justify-between text-card items-center">
                  <span className={`text-meta uppercase ${mutedClass}`}>{t('exercises.' + ex.id)}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{ex.weight}kg</span>
                    <div className="flex gap-0.5">{ex.setsCompleted.map((r, ri) => (
                      <div key={ri} className={r === targetReps(ex, ri) ? 'w-1.5 h-1.5 rounded-full bg-accent' : `w-1.5 h-1.5 rounded-full border border-ink/30`} />
                    ))}</div>
                  </div>
                </div>
              ))}</div>
            </button>
          );
          const stats = getWorkoutStats(history);
          return (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-title font-medium">{t('log.title')}</h2>
              <button
                onClick={() => {
                  // Defaults to whatever program/day you're actually on -- the modal lets
                  // you pick a different program and day before saving.
                  const prog = getProgram(preset);
                  const day = getCurrentDay(prog.id);
                  const exercises = prog.dayExercises(day, { program, weights, mcTop, mcInterval, mcPress })
                    .map(ex => ({ ...ex, setsCompleted: Array.from({ length: ex.sets }, (_, i) => targetReps(ex, i)) }));
                  setEditingEntry({ index: -1, session: { date: new Date().toISOString(), type: day, preset: prog.id, exercises } });
                }}
                aria-label="Add workout"
                className={`w-10 h-10 rounded-lg border flex items-center justify-center active:scale-90 transition-transform border-ink/18 text-ink`}
              ><Plus size={18} /></button>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className={i < stats.thisWeek ? 'w-2 h-2 rounded-full bg-accent' : `w-2 h-2 rounded-full border border-ink/30`} />
                ))}
              </div>
              <span className={`text-body ${mutedClass}`}>{stats.thisWeek >= 3 ? t('log.weekDone') : t('log.toGo', { count: 3 - stats.thisWeek })}</span>
              <span className={mutedClass}>·</span>
              <span className={`text-body ${mutedClass}`}>{t('header.streak', { count: stats.streak })}</span>
              <span className={mutedClass}>·</span>
              <span className={`text-body ${mutedClass}`}>{stats.total} {t('log.total')}</span>
            </div>

            {history.length > 0 && (
              <div className={`flex rounded-lg border overflow-hidden mb-2 border-ink/10`}>
                {[{ label: t('log.all'), val: 'all' }, { label: t('log.week'), val: 'week' }, { label: t('log.month'), val: 'month' }, { label: t('log.year'), val: 'year' }].map((opt, i) => (
                  <button
                    key={opt.val}
                    onClick={() => { setLogGrouping(opt.val); if (opt.val !== 'all') { const groups = groupHistory(history, opt.val, 0); setExpandedGroups(groups.length > 0 ? { [groups[0].key]: true } : {}); } else { setExpandedGroups({}); } }}
                    className={`flex-1 py-3 text-meta uppercase tracking-wide transition-all ${i > 0 ? ('border-l border-ink/10') : ''} ${logGrouping === opt.val ? 'bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_#9184d9]' : mutedClass}`}
                  >{opt.label}</button>
                ))}
              </div>
            )}

            {history.length === 0 ? (
              <p className={`py-20 text-center ${mutedClass}`}>{t('log.noHistory')}</p>
            ) : logGrouping === 'all' ? (
              history.map((s, i) => renderEntry(s, i, () => setEditingEntry({ index: i, session: JSON.parse(JSON.stringify(s)) })))
            ) : (
              groupHistory(history, logGrouping, 0).map((group) => (
                <div key={group.key}>
                  <button
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                    aria-label={`Toggle ${group.key}`}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-[10px] border transition-all active:scale-[0.99] bg-surface border-ink/8`}
                  >
                    <div className="flex items-center gap-3">
                      {expandedGroups[group.key] ? <CaretDown size={18} className={mutedClass} /> : <CaretRight size={18} className={mutedClass} />}
                      <span className="text-card font-medium">{group.key}</span>
                    </div>
                    <span className={`text-body px-2.5 py-1 rounded-lg bg-surface-deep text-ink/60`}>{group.entries.length}</span>
                  </button>
                  {expandedGroups[group.key] && (
                    <div className="space-y-3 mt-3 ml-2">
                      {group.entries.map(({ session: s, originalIndex }) => renderEntry(s, originalIndex, () => setEditingEntry({ index: originalIndex, session: JSON.parse(JSON.stringify(s)) })))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          );
        })()}

        {activeTab === 'progress' && (() => {
          const mutedClass = 'text-ink/45';
          const cardClass = `w-full p-4 rounded-[10px] border flex justify-between items-center active:scale-[0.98] transition-transform bg-surface border-ink/8`;
          const trendIconFor = (trend) => trend === 'up' ? { Icon: TrendUp, className: 'text-accent' } : trend === 'down' ? { Icon: TrendDown, className: mutedClass } : { Icon: ArrowRight, className: 'text-ink/40' };
          return (
          <div className="space-y-6">
            {history.length === 0 ? (
              <div className="py-20 text-center px-10">
                <h2 className="text-lg font-semibold mb-2">{t('stats.noStats')}</h2>
                <p className={`text-card leading-relaxed ${mutedClass}`}>{t('stats.noStatsBody')}</p>
              </div>
            ) : statsView ? (
              <StatsChart exerciseId={statsView} history={history} onBack={() => setStatsView(null)} weights={weights} best1RMs={best1RMs} />
            ) : (
              <>
                <h2 className="text-title font-medium mb-4">{t('stats.title')}</h2>
                {(() => {
                  const big3Trend = getBig3Trend(history);
                  const { Icon: TrendIcon, className: trendClass } = trendIconFor(big3Trend);
                  return (
                    <button onClick={() => setStatsView('big3')} className={cardClass}>
                      <div className="text-left">
                        <p className="text-kicker font-semibold uppercase tracking-[0.14em] text-accent mb-1">{t('stats.big3Total')}</p>
                        <p className="text-title font-medium tabular-nums">{big3Total}kg</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {big3Trend && <TrendIcon size={18} className={trendClass} />}
                        <CaretRight size={18} className={mutedClass} />
                      </div>
                    </button>
                  );
                })()}
                <div className="grid gap-3">{(() => {
                  const activeIds = programAllLiftIds(preset, { program, weights, mcTop, mcInterval, mcPress });
                  // Lifts trained under the other program stay visible here too, instead of
                  // vanishing from Stats the moment you switch programs.
                  const extraIds = [...EXPECTED_WEIGHT_KEYS, 'incline'].filter(id =>
                    !activeIds.includes(id) && history.some(s => s.exercises?.some(e => e.id === id))
                  );
                  const otherProgramName = t(getProgram(PROGRAM_IDS.find(id => id !== normalizePreset(preset))).nameKey);
                  return [...activeIds, ...extraIds].map(id => {
                    const trend = getExerciseTrend(history, id);
                    const { Icon: TrendIcon, className: trendClass } = trendIconFor(trend);
                    const hasData = history.some(s => s.exercises?.some(e => e.id === id));
                    const isExtra = extraIds.includes(id);
                    return (
                      <button key={id} onClick={() => setStatsView(id)} className={cardClass}>
                        <div className="min-w-0 pr-2 text-left">
                          <p className="text-card font-medium truncate">{t('exercises.' + id)}</p>
                          {hasData ? (
                            <p className={`text-meta uppercase leading-none mt-1 ${mutedClass}`}>{t('stats.est1rmValue', { value: best1RMs[id] || weights[id] })}</p>
                          ) : (
                            <p className={`text-meta leading-snug mt-1 ${mutedClass}`}>{t('stats.noSessionsForLift')}</p>
                          )}
                          {isExtra && (
                            <p className={`text-tab uppercase tracking-wide mt-0.5 ${mutedClass}`}>{t('stats.fromProgram', { program: otherProgramName })}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {trend && <TrendIcon size={18} className={trendClass} />}
                          <span className="text-accent-300 tabular-nums">{weights[id]}kg</span>
                          <CaretRight size={18} className={mutedClass} />
                        </div>
                      </button>
                    );
                  });
                })()}
                </div>
              </>
            )}
          </div>
          );
        })()}

        {activeTab === 'program' && (
          <ProgramTab
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

        {activeTab === 'settings' && (() => {
          const mutedClass = 'text-ink/45';
          const cardClass = `p-4 rounded-[10px] border bg-surface border-ink/8`;
          const innerRowClass = 'rule-fade';
          const Switch = ({ checked, onChange, ariaLabel }) => (
            <button
              onClick={onChange}
              role="switch"
              aria-checked={checked}
              aria-label={ariaLabel}
              className={`w-[46px] h-[26px] rounded-full border relative shrink-0 transition-colors ${checked ? 'border-accent bg-accent-900' : ('border-ink/18')}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${checked ? `translate-x-[21px] bg-accent` : `translate-x-0 bg-ink/45`}`} />
            </button>
          );
          const Segmented = ({ options, value, onChange }) => (
            <div className={`flex rounded-lg border overflow-hidden border-ink/10`}>
              {options.map((opt, i) => (
                <button
                  key={opt.val}
                  onClick={() => onChange(opt.val)}
                  className={`flex-1 py-3 text-meta uppercase tracking-wide transition-all ${i > 0 ? ('border-l border-ink/10') : ''} ${value === opt.val ? 'bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_#9184d9]' : mutedClass}`}
                >{opt.label}</button>
              ))}
            </div>
          );
          return (
          <div className="space-y-6">
            <h2 className="text-title font-medium mb-6">{t('options.title')}</h2>
            <div className={cardClass}>
              <div className="mb-4">
                <p className="text-card font-semibold">{t('options.restInterval')}</p>
                <p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.restIntervalDesc')}</p>
              </div>
              <Segmented
                options={[{ label: '1:30', val: 90 }, { label: '3:00', val: 180 }, { label: '5:00', val: 300 }]}
                value={preferredRest}
                onChange={setPreferredRest}
              />
            </div>

            <div className={cardClass}>
              <div className={`flex items-center justify-between pb-4 mb-4 ${innerRowClass}`}>
                <div><p className="text-card font-semibold">{t('options.soundAlert')}</p><p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.soundAlertDesc')}</p></div>
                <Switch checked={soundEnabled} onChange={() => setSoundEnabled(!soundEnabled)} ariaLabel="Sound alert" />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-card font-semibold">{t('options.vibration')}</p><p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.vibrationDesc')}</p></div>
                <Switch checked={vibrationEnabled} onChange={() => setVibrationEnabled(!vibrationEnabled)} ariaLabel="Vibration" />
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div><p className="text-card font-semibold">{t('options.darkMode')}</p><p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.darkModeDesc')}</p></div>
                <Switch checked={isDark} onChange={() => setIsDark(!isDark)} ariaLabel="Dark mode" />
              </div>
            </div>

            {/* Backup & Sync */}
            <div className={cardClass}>
              <div className={`pb-4 mb-4 ${innerRowClass}`}>
                <p className="text-card font-semibold">{t('options.backupSync')}</p>
                <p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.backupSyncDesc')}</p>
              </div>

              {/* Local Backup toggle */}
              <div className={`flex items-center justify-between pb-4 mb-4 ${innerRowClass}`}>
                <div><p className="text-body font-medium">{t('options.localBackup')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.localBackupDesc')}</p></div>
                <Switch checked={localBackup} onChange={() => setLocalBackup(!localBackup)} ariaLabel="Local backup" />
              </div>

              {/* Google Drive section */}
              {driveConfigured && (
                <div className={`pb-4 mb-4 ${innerRowClass}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div><p className="text-body font-medium">{t('options.googleDrive')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.googleDriveDesc')}</p></div>
                    {gdrive.isConnected ? (
                      <span className={`text-meta uppercase px-2.5 py-1.5 rounded-lg text-accent-300 bg-accent-900`}>{t('options.connectedToDrive')}</span>
                    ) : (
                      <button onClick={handleConnect} className={`text-meta uppercase px-3.5 py-2.5 rounded-lg border active:scale-95 border-ink/18 text-ink`}>{gdrive.hasEverConnected ? t('options.reconnectDrive') : t('options.connectDrive')}</button>
                    )}
                  </div>
                  {(gdrive.isConnected || gdrive.hasEverConnected) && (
                    <div className="mt-3 space-y-2">
                      <p className={`text-meta leading-tight ${mutedClass}`}>{t('options.savesAfterWorkout')}</p>
                      <div className="flex items-center justify-between">
                        {gdrive.saveFailed ? (
                          <button onClick={handleDriveSave} className={`text-meta active:scale-95 ${mutedClass}`}>{t('options.saveFailed')}</button>
                        ) : gdrive.lastSavedAt ? (
                          <p className="text-meta text-accent">{t('options.lastSaved', { time: formatLastSaved(gdrive.lastSavedAt) })}</p>
                        ) : <span />}
                        <button onClick={handleDriveSave} disabled={gdrive.isLoading} className={`text-meta uppercase px-3.5 py-2.5 rounded-lg border active:scale-95 disabled:opacity-35 border-ink/18 text-ink`}>{t('options.syncNow')}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Backup & Restore buttons */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={() => exportData()} className="py-3.5 rounded-lg border border-accent text-accent flex flex-col items-center gap-2 text-meta uppercase active:scale-95 transition-transform">
                  <DownloadSimple size={20} /> {t('options.backupToDevice')}
                </button>
                <button onClick={() => fileInputRef.current?.click()} className={`py-3.5 rounded-lg border flex flex-col items-center gap-2 text-meta uppercase active:scale-95 transition-transform border-ink/18 text-ink`}>
                  <UploadSimple size={20} /> {t('options.restore')}
                </button>
              </div>
              <button onClick={() => csvInputRef.current?.click()} className={`w-full py-3.5 rounded-lg border flex items-center justify-center gap-2 text-meta uppercase active:scale-95 transition-transform border-ink/18 text-ink`}>
                <FileCsv size={20} /> {t('options.importStronglifts')}
              </button>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div><p className="text-card font-semibold">{t('options.language')}</p><p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.languageDesc')}</p></div>
                <div className="w-24">
                  <Segmented
                    options={[{ label: 'EN', val: 'en' }, { label: 'FR', val: 'fr' }]}
                    value={i18n.language?.startsWith('fr') ? 'fr' : 'en'}
                    onChange={(code) => i18n.changeLanguage(code)}
                  />
                </div>
              </div>
            </div>
          </div>
          );
        })()}
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
