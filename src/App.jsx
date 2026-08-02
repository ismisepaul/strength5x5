import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Barbell, ListChecks, Gear, Play, TrendUp,
  Plus, Minus, Check, X, DownloadSimple, UploadSimple,
  Question, TrendDown, Moon,
  Trash, CaretRight, Timer,
  FileCsv, ArrowRight, Flame, CaretDown,
  Cloud, SlidersHorizontal, ChartLineUp, PencilSimple
} from '@phosphor-icons/react';

import { useTranslation } from 'react-i18next';
import i18n from './i18n/index.js';
import { WORKOUTS, INITIAL_WEIGHTS, STORAGE_KEY, SCHEMA_VERSION, EXPECTED_WEIGHT_KEYS, MAX_IMPORT_SIZE, ACTIVE_WORKOUT_KEY, MAX_SETS, MADCOW_DAYS, MADCOW_DAY_MOOD, MADCOW_ONRAMP_WEEKS, MADCOW_DEFAULT_INTERVAL } from './constants';
import { validateImportData, calculateBest1RM, calculateDeload, deloadWeightByPercent, getConsecutiveFailures, getRecommendedDeloadPercent, formatDuration, formatClock, calculateSetDurations, normalizeProgram, getProgramExercises, targetReps, isExercisePassed, normalizePreset, normalizeMcTop, normalizeMcWeek, normalizeMcInterval, normalizeMcPress, normalizeMcNextDay, seedMadcowTops, madcowTopsToWeights, applyMcTopToWeights, getMadcowDayExercises, getMadcowDayLiftIds, evaluateMadcowOutcome, madcowRestSeconds } from './utils';
import { convertStrongliftsCSV } from './utils/convertStronglifts';
import { getExerciseTrend, getBig3Trend, getWorkoutStats, groupHistory } from './utils/chartData';
import { useLoadSaved, useSyncStorage, useStorageSync } from './hooks/useLocalStorage';
import { useTimer } from './hooks/useTimer';
import { useWakeLock } from './hooks/useWakeLock';
import RestTimer from './components/RestTimer';
import ExerciseCard from './components/ExerciseCard';
import BarSetupDiagram from './components/BarSetupDiagram';
import RepPicker from './components/RepPicker';
import ProgramTab from './components/ProgramTab';
import StatsChart from './components/StatsChart';
import Toast from './components/Toast';
import WeightEditBar from './components/WeightEditBar';
import { useToast } from './hooks/useToast';
import { useGoogleDrive } from './hooks/useGoogleDrive';

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
  const [editingWeightId, setEditingWeightId] = useState(null);
  const [isExerciseComplete, setIsExerciseComplete] = useState(false);
  const [pendingCSVImport, setPendingCSVImport] = useState(null);
  const [statsView, setStatsView] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const audioCtxRef = useRef(null);
  const reverbRef = useRef(null);

  const gdrive = useGoogleDrive();

  useWakeLock();

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const duration = 2;
        const rate = audioCtxRef.current.sampleRate;
        const length = rate * duration;
        const impulse = audioCtxRef.current.createBuffer(2, length, rate);
        for (let c = 0; c < 2; c++) {
          const data = impulse.getChannelData(c);
          for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
          }
        }
        const convolver = audioCtxRef.current.createConvolver();
        convolver.buffer = impulse;
        reverbRef.current = convolver;
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') { ctx.resume(); }

      const now = ctx.currentTime;
      const mainGain = ctx.createGain();
      const dryGain = ctx.createGain();
      const reverbGain = ctx.createGain();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();

      osc1.type = 'sine'; osc2.type = 'sine';
      osc1.frequency.value = 1358; osc2.frequency.value = 2844;
      osc1.connect(mainGain); osc2.connect(mainGain);
      mainGain.connect(dryGain); mainGain.connect(reverbGain);
      dryGain.connect(ctx.destination);

      if (reverbRef.current) {
        reverbGain.connect(reverbRef.current);
        reverbRef.current.connect(ctx.destination);
      }

      dryGain.gain.setValueAtTime(0.8, now);
      reverbGain.gain.setValueAtTime(0.2, now);
      mainGain.gain.setValueAtTime(0, now);
      mainGain.gain.linearRampToValueAtTime(0.6, now + 0.005);
      mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.start(now); osc2.start(now);
      osc1.stop(now + 0.5); osc2.stop(now + 0.5);
    } catch (e) { /* WebAudio may fail silently */ }
  }, []);

  const timer = useTimer({
    onExpire: () => {
      if (soundEnabled) playChime();
      if (vibrationEnabled && navigator?.vibrate) { navigator.vibrate([200, 100, 200]); }
    }
  });

  useSyncStorage({
    weights, program, history, nextType: currentWorkoutType,
    isDark, autoSave: localBackup, preferredRest, soundEnabled, vibrationEnabled, logGrouping,
    preset, mcTop, mcWeek, mcInterval, mcPress, mcNextDay,
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
  });

  useEffect(() => {
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
    preset, mcTop, mcWeek, mcInterval, mcPress, mcNextDay,
  }), [weights, program, history, currentWorkoutType, isDark, localBackup, preferredRest, soundEnabled, vibrationEnabled, logGrouping, preset, mcTop, mcWeek, mcInterval, mcPress, mcNextDay]);

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


  const handleUpdateActiveWeight = useCallback((exIdx, diff) => {
    setCurrentWorkout(prev => prev ? ({ ...prev, exercises: prev.exercises.map((e, i) => i !== exIdx ? e : ({ ...e, weight: Math.max(0, e.weight + diff) })) }) : null);
  }, []);

  // Idle-screen steppers adjust `weights` directly (there's no active workout yet),
  // floored at the empty 20kg bar rather than active-session's 0.
  const handleUpdateIdleWeight = useCallback((id, diff) => {
    setWeights(prev => ({ ...prev, [id]: Math.max(20, (prev[id] ?? 0) + diff) }));
  }, []);

  const [draftWeight, setDraftWeight] = useState('');

  const parseWeightInput = (str) => {
    const n = parseFloat(String(str).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  // A single draft lives alongside editingWeightId: opening another editor
  // overwrites it, discarding whatever was being typed for the previous one.
  const handleStartEditWeight = useCallback((id, currentWeight) => {
    setEditingWeightId(id);
    setDraftWeight(String(currentWeight));
  }, []);

  const handleCancelEditWeight = useCallback(() => {
    setEditingWeightId(null);
    setDraftWeight('');
  }, []);

  const stepDraftWeight = useCallback((diff, fallback) => {
    setDraftWeight(prev => {
      const parsed = parseWeightInput(prev);
      const base = parsed !== null ? parsed : fallback;
      return String(Math.max(20, base + diff));
    });
  }, []);

  // Commits by computing a diff against the current weight and handing it to the
  // existing per-screen update fn, so the real write path (and its own floor) is untouched.
  const commitEditWeight = useCallback((currentWeight, applyDiff) => {
    const parsed = parseWeightInput(draftWeight);
    const final = parsed !== null ? Math.max(20, Math.round(parsed / 2.5) * 2.5) : currentWeight;
    if (final !== currentWeight) applyDiff(final - currentWeight);
    setEditingWeightId(null);
    setDraftWeight('');
  }, [draftWeight]);

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
          const req = Array.isArray(ex.setWeights)
            ? madcowRestSeconds(ex.setWeights[setIdx + 1], Math.max(...ex.setWeights), preferredRest)
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

  const evaluateWorkoutOutcome = useCallback((workout, priorHistory, baseWeights) => {
    const nextWeights = { ...baseWeights };
    const progressions = [];
    const pendingDeloads = [];

    workout.exercises.forEach(ex => {
      const passed = isExercisePassed(ex);
      const defaultIncrement = ex.id === 'deadlift' ? 5 : 2.5;
      const increment = ex.increment
        ?? WORKOUTS[workout.type]?.exercises.find(e => e.id === ex.id)?.increment
        ?? defaultIncrement;

      if (passed) {
        nextWeights[ex.id] = ex.weight + increment;
        progressions.push(ex.id);
      } else {
        const priorFailures = getConsecutiveFailures(priorHistory, ex.id, ex.weight);
        if (priorFailures >= 2) {
          pendingDeloads.push({ id: ex.id, currentWeight: ex.weight });
        }
      }
    });

    return { nextWeights, progressions, pendingDeloads };
  }, []);

  const getPendingFailureDeloadsForStart = useCallback((historyToCheck, workoutWeights) => {
    const exercises = Object.values(WORKOUTS)
      .flatMap(workout => workout.exercises)
      .filter((exercise, index, arr) => arr.findIndex(e => e.id === exercise.id) === index);
    const getLatestFailureStreak = (exerciseId) => {
      const latestSessionWithExercise = historyToCheck.find(session => session.exercises?.some(e => e.id === exerciseId));
      const latestExercise = latestSessionWithExercise?.exercises?.find(e => e.id === exerciseId);
      if (!latestExercise) return { streakWeight: null, consecutiveFailures: 0 };
      const streakWeight = latestExercise.weight;
      return {
        streakWeight,
        consecutiveFailures: getConsecutiveFailures(historyToCheck, exerciseId, streakWeight),
      };
    };
    const diagnostics = exercises.map(ex => {
      const streak = getLatestFailureStreak(ex.id);
      return {
        id: ex.id,
        plannedWeight: workoutWeights[ex.id],
        streakWeight: streak.streakWeight,
        consecutiveFailures: streak.consecutiveFailures,
      };
    });
    const pending = diagnostics
      .filter(ex => ex.consecutiveFailures >= 3)
      .map(ex => ({ id: ex.id, currentWeight: ex.plannedWeight }));
    return pending;
  }, []);

  const getStartDeloadPrompt = useCallback((historyToCheck, workoutWeights) => {
    if (historyToCheck.length === 0) return null;

    const lastWorkoutDate = historyToCheck[0].date;
    const last = new Date(lastWorkoutDate);
    const daysOff = Math.floor((new Date() - last) / 86400000);
    if (daysOff >= 14 && longBreakDeloadForDate !== lastWorkoutDate) {
      const recommended = getRecommendedDeloadPercent(daysOff);
      return { type: 'longBreak', daysOff, recommended };
    }

    // Madcow's stall is "the top set holds" -- no forced-deload prompt, only the
    // long-break safety check above applies to it.
    if (preset !== 'standard') return null;

    const pendingDeloads = getPendingFailureDeloadsForStart(historyToCheck, workoutWeights);
    if (pendingDeloads.length > 0) {
      return { type: 'failure', pendingDeloads };
    }

    return null;
  }, [getPendingFailureDeloadsForStart, longBreakDeloadForDate, preset]);

  const finishWorkout = useCallback(() => {
    const isMadcow = preset === 'madcow';
    const savedWorkout = {
      ...currentWorkout,
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
    let progressions, pendingDeloads, summaryNextValues;

    if (isMadcow) {
      const outcome = evaluateMadcowOutcome(currentWorkout.type, currentWorkout.exercises, mcTop, mcWeek, MADCOW_ONRAMP_WEEKS);
      nextMcTop = outcome.nextTop;
      nextMcWeek = outcome.nextWeek;
      nextWeights = applyMcTopToWeights(weights, nextMcTop);
      nextMcNextDay = MADCOW_DAYS[(MADCOW_DAYS.indexOf(currentWorkout.type) + 1) % MADCOW_DAYS.length];
      progressions = outcome.progressions;
      pendingDeloads = [];
      summaryNextValues = nextMcTop;
      setMcTop(nextMcTop); setMcWeek(nextMcWeek); setMcNextDay(nextMcNextDay); setWeights(nextWeights);
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
      preset, mcTop: nextMcTop, mcWeek: nextMcWeek, mcInterval, mcPress, mcNextDay: nextMcNextDay,
    });
  }, [currentWorkout, history, weights, program, localBackup, exportData, timer, currentWorkoutType, isDark, preferredRest, soundEnabled, vibrationEnabled, logGrouping, saveToDriveQuietly, evaluateWorkoutOutcome, preset, mcTop, mcWeek, mcInterval, mcPress, mcNextDay]);

  const cancelWorkout = useCallback(() => {
    setIsWorkoutActive(false); setCurrentWorkout(null);
    timer.reset(); setIsExerciseComplete(false); setShowCancelModal(false);
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
  }, [timer]);

  const initializeWorkout = useCallback((workoutWeights) => {
    if (preset === 'madcow') {
      const exercises = getMadcowDayExercises(mcNextDay, mcTop, mcInterval, mcPress).map(ex => ({
        ...ex, setsCompleted: new Array(ex.sets).fill(null), setTimes: new Array(ex.sets).fill(null),
      }));
      setCurrentWorkout({ date: new Date().toISOString(), type: mcNextDay, startedAt: Date.now(), exercises });
    } else {
      setCurrentWorkout({ date: new Date().toISOString(), type: currentWorkoutType, startedAt: Date.now(), exercises: getProgramExercises(currentWorkoutType, program).map(ex => ({ ...ex, weight: workoutWeights[ex.id], setsCompleted: new Array(ex.sets).fill(null), setTimes: new Array(ex.sets).fill(null) })) });
    }
    setIsWorkoutActive(true); setActiveTab('workout'); setShowRestorePrompt(false); setIsExerciseComplete(false);
  }, [currentWorkoutType, program, preset, mcNextDay, mcTop, mcInterval, mcPress]);

  const startWorkout = useCallback((force = false) => {
    if (history.length === 0 && !force) { setShowRestorePrompt(true); return; }
    const prompt = getStartDeloadPrompt(history, weights);
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
  }, [history, weights, initializeWorkout, getStartDeloadPrompt, t]);

  // Switches the active program, converting weights each direction so Stats and the
  // Program tab always agree with whatever's actually being trained.
  const switchProgram = useCallback((target) => {
    if (isWorkoutActive) cancelWorkout();
    if (target === 'madcow') {
      const seeded = seedMadcowTops(weights);
      setMcTop(seeded);
      setMcWeek(1);
      setMcNextDay('A');
      setWeights(prev => applyMcTopToWeights(prev, seeded));
    } else {
      setWeights(prev => madcowTopsToWeights(prev, mcTop, mcPress));
    }
    setPreset(target);
    setProgramSheet(null);
  }, [weights, mcTop, mcPress, isWorkoutActive, cancelWorkout]);

  const updateMcTop = useCallback((id, diff) => {
    setMcTop(prev => {
      const next = { ...prev, [id]: Math.max(INITIAL_WEIGHTS[id] ?? 20, prev[id] + diff) };
      setWeights(w => applyMcTopToWeights(w, next));
      return next;
    });
  }, []);

  const applyLocalImport = useCallback((d) => {
    setWeights(d.weights); setProgram(normalizeProgram(d.program)); setHistory(d.history);
    if (d.nextType) setCurrentWorkoutType(d.nextType);
    setIsDark(d.isDark ?? true); setLocalBackup(d.autoSave ?? false);
    if (d.preferredRest) setPreferredRest(d.preferredRest);
    if (d.soundEnabled !== undefined) setSoundEnabled(d.soundEnabled);
    if (d.vibrationEnabled !== undefined) setVibrationEnabled(d.vibrationEnabled);
    if (d.logGrouping) setLogGrouping(d.logGrouping);
    if (d.language) i18n.changeLanguage(d.language);
    setPreset(normalizePreset(d.preset));
    setMcTop(normalizeMcTop(d.mcTop, d.weights));
    setMcWeek(normalizeMcWeek(d.mcWeek));
    setMcInterval(normalizeMcInterval(d.mcInterval));
    setMcPress(normalizeMcPress(d.mcPress));
    setMcNextDay(normalizeMcNextDay(d.mcNextDay));
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
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target.result);
        const d = validateImportData(raw);
        if (!d) {
          console.warn('Import failed: invalid data structure');
          showToast(t('toast.invalidBackup'), 'error');
          return;
        }

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
      } catch (err) {
        console.warn('Import failed:', err);
        showToast(t('toast.couldNotRead'), 'error');
      }
    };
    reader.readAsText(file);
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
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = convertStrongliftsCSV(event.target.result);
        if (!result.history.length) {
          console.warn('StrongLifts import failed: no valid workouts found');
          showToast(t('toast.noValidWorkouts'), 'error');
          return;
        }
        setPendingCSVImport(result);
      } catch (err) {
        console.warn('StrongLifts import failed:', err);
        showToast(t('toast.couldNotReadCSV'), 'error');
      }
    };
    reader.readAsText(file);
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
    setWeights(d.weights); setProgram(normalizeProgram(d.program)); setHistory(d.history);
    if (d.nextType) setCurrentWorkoutType(d.nextType);
    setIsDark(d.isDark ?? true); setLocalBackup(d.autoSave ?? false);
    if (d.preferredRest) setPreferredRest(d.preferredRest);
    if (d.soundEnabled !== undefined) setSoundEnabled(d.soundEnabled);
    if (d.vibrationEnabled !== undefined) setVibrationEnabled(d.vibrationEnabled);
    if (d.logGrouping) setLogGrouping(d.logGrouping);
    if (d.language) i18n.changeLanguage(d.language);
    setPreset(normalizePreset(d.preset));
    setMcTop(normalizeMcTop(d.mcTop, d.weights));
    setMcWeek(normalizeMcWeek(d.mcWeek));
    setMcInterval(normalizeMcInterval(d.mcInterval));
    setMcPress(normalizeMcPress(d.mcPress));
    setMcNextDay(normalizeMcNextDay(d.mcNextDay));
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
    if (audioCtxRef.current?.state === 'suspended') { audioCtxRef.current.resume(); }
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
    const mood = MADCOW_DAY_MOOD[day];
    return t('program.madcow.mood' + mood.charAt(0).toUpperCase() + mood.slice(1));
  };

  return (
    <div className={`h-viewport max-w-md mx-auto flex flex-col font-sans transition-colors duration-300 ${isDark ? 'bg-ground text-ink' : 'bg-ground-lt text-ink-lt'}`}>

      {!isMidWorkout && (
        <header className="flex-none header-safe px-5 pb-2.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Barbell weight="fill" size={20} className="text-accent" />
            <h1 className="text-[17px] font-semibold">{t('app.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Flame size={15} weight="fill" className="text-accent" />
              <span className={`text-[12.5px] ${isDark ? 'text-ink/55' : 'text-ink-lt/55'}`}>{t('header.streak', { count: workoutStats.streak })}</span>
            </div>
            <button
              onClick={() => setShowHelp(true)}
              aria-label="How it works"
              className={`w-9 h-9 rounded-lg border flex items-center justify-center ${isDark ? 'border-ink/15 text-ink' : 'border-ink-lt/15 text-ink-lt'}`}
            ><Question size={18} /></button>
          </div>
        </header>
      )}

      {timerVisible && (
        <RestTimer
          seconds={timer.seconds} total={preferredRest}
          isDark={isDark} isExerciseComplete={isExerciseComplete} isExpired={timer.isExpired} isActive={timer.isActive}
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
                  const isMadcow = preset === 'madcow';
                  const day = isMadcow ? mcNextDay : currentWorkoutType;
                  const liftIds = isMadcow ? getMadcowDayLiftIds(mcNextDay, mcPress) : getProgramExercises(currentWorkoutType, program).map(ex => ex.id);
                  const dayExercises = isMadcow ? getMadcowDayExercises(mcNextDay, mcTop, mcInterval, mcPress) : getProgramExercises(currentWorkoutType, program).map(ex => ({ ...ex, weight: weights[ex.id] }));
                  return (
                    <>
                      <div className="mb-4">
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent mb-1">{isMadcow ? t('workout.madcowKicker', { week: mcWeek }) : t('workout.standardKicker')}</p>
                        <div className="flex items-center gap-[10px]">
                          <h2 className="text-[32px] font-medium leading-tight">{t(`workout.type${day}`)}</h2>
                          <button
                            onClick={() => setWorkoutPicker(true)}
                            aria-label={t('workout.chooseWorkoutAria')}
                            className={`w-[38px] h-[38px] rounded-lg border flex items-center justify-center shrink-0 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}
                          ><CaretDown size={16} /></button>
                        </div>
                        <p className={`text-[13.5px] mt-1 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>
                          {isMadcow
                            ? t('workout.madcowSubtitle', { mood: moodLabel(mcNextDay), lifts: liftIds.map(id => t('exercises.' + id)).join(' · ') })
                            : liftIds.map(id => t('exercises.' + id)).join(' · ')}
                        </p>
                      </div>
                      <div className="mb-8">{dayExercises.map((ex, i) => {
                        const liftId = liftIds[i];
                        const exName = t('exercises.' + liftId);
                        const isBarSetupOpen = !!expandedBarSetup[liftId];
                        const topWeight = isMadcow ? Math.max(...ex.setWeights) : ex.weight;
                        return (
                        <div key={liftId} className={`py-[15px] ${isDark ? 'rule-fade' : 'rule-fade-lt'}`}>
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => setExpandedBarSetup(prev => ({ ...prev, [liftId]: !prev[liftId] }))}
                              aria-expanded={isBarSetupOpen}
                              className="flex flex-col items-start min-h-[44px] text-left flex-1 min-w-0 pr-3"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-[16px] font-medium truncate">{exName}</p>
                                <CaretDown size={12} weight="bold" className={`shrink-0 opacity-35 transition-transform ${isBarSetupOpen ? 'rotate-180' : ''}`} />
                              </div>
                              <p className={`text-[12.5px] ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>
                                {isMadcow ? (day === 'C' ? t('workout.dayCMeta') : t('workout.rampSetsMeta', { sets: ex.sets, from: Math.min(...ex.setWeights), to: topWeight })) : `${ex.sets} × ${ex.reps}`}
                              </p>
                            </button>
                            {isMadcow ? (
                              <span className="text-[19px] text-accent-300 tabular-nums shrink-0 min-h-[44px] flex items-center">{topWeight}kg</span>
                            ) : (
                              <button
                                onClick={() => handleStartEditWeight(liftId, weights[liftId])}
                                aria-label={t('workout.editWeightAria', { name: exName })}
                                className="flex items-center gap-1.5 min-h-[44px] shrink-0"
                              >
                                <span className="text-[19px] text-accent-300 tabular-nums">{weights[liftId]}kg</span>
                                <PencilSimple size={13} className={isDark ? 'text-ink/35' : 'text-ink-lt/35'} />
                              </button>
                            )}
                          </div>
                          {!isMadcow && editingWeightId === liftId && (
                            <WeightEditBar
                              value={draftWeight}
                              onChange={setDraftWeight}
                              onDecrement={() => stepDraftWeight(-ex.increment, weights[liftId])}
                              onIncrement={() => stepDraftWeight(ex.increment, weights[liftId])}
                              onCommit={() => commitEditWeight(weights[liftId], (diff) => handleUpdateIdleWeight(liftId, diff))}
                              onCancel={handleCancelEditWeight}
                              isDark={isDark}
                              variant="row"
                              exerciseName={exName}
                            />
                          )}
                          {isBarSetupOpen && (
                            <div className={`mt-3 rounded-[9px] p-3.5 ${isDark ? 'bg-surface/70' : 'bg-surface-lt/70'}`}>
                              <BarSetupDiagram weight={topWeight} isDark={isDark} />
                            </div>
                          )}
                        </div>
                        );
                      })}</div>
                    </>
                  );
                })()}
                <button onClick={() => startWorkout()} disabled={trainedToday} className={`w-full h-[54px] rounded-lg border border-accent text-accent font-medium text-[16px] flex items-center justify-center gap-2 transition-opacity ${trainedToday ? 'opacity-35' : 'active:scale-[0.98]'}`}><Play size={18} weight="fill" /> {trainedToday ? t('workout.trainedToday') : t('workout.startWorkout')}</button>
                <p className={`text-[12px] text-center mt-3 ${isDark ? 'text-ink/38' : 'text-ink-lt/38'}`}>{trainedToday ? t('workout.alreadyTrained') : t('workout.weekProgress', { count: workoutStats.thisWeek })}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center mb-2"><h2 className={`text-[10.5px] font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{currentWorkout ? t(`workout.type${currentWorkout.type}`) : ''}</h2></div>
                {(() => {
                  const anySetLogged = currentWorkout?.exercises.some(ex => ex.setsCompleted.some(s => s !== null));
                  return currentWorkout?.exercises.map((ex, exIdx) => (
                    <ExerciseCard
                      key={ex.id}
                      ex={ex}
                      exIdx={exIdx}
                      isDark={isDark}
                      onToggleSet={handleToggleSet}
                      onOpenRepPicker={handleOpenRepPicker}
                      showHint={exIdx === 0 && !anySetLogged}
                      isEditingWeight={editingWeightId === ex.id}
                      draftWeight={draftWeight}
                      onDraftWeightChange={setDraftWeight}
                      onStartEditWeight={() => handleStartEditWeight(ex.id, ex.weight)}
                      onStepWeight={(diff) => stepDraftWeight(diff, ex.weight)}
                      onCommitWeight={() => commitEditWeight(ex.weight, (diff) => handleUpdateActiveWeight(exIdx, diff))}
                      onCancelEditWeight={handleCancelEditWeight}
                    />
                  ));
                })()}
                <div className="pt-4 flex flex-col items-center">
                  {(() => {
                    const allDone = currentWorkout?.exercises.every(ex => ex.setsCompleted.every(s => s !== null));
                    return (
                      <>
                        <button onClick={finishWorkout} disabled={!allDone} className={`w-full h-[52px] rounded-lg border font-medium text-[15.5px] ${allDone ? 'border-accent text-accent active:scale-[0.98]' : (isDark ? 'border-ink/12 text-ink/30' : 'border-ink-lt/12 text-ink-lt/30')}`}>{t('workout.finishWorkout')}</button>
                        {!allDone && <p className={`text-[12px] text-center mt-3 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('workout.completeAllSets')}</p>}
                      </>
                    );
                  })()}
                  <button onClick={() => setShowCancelModal(true)} className={`mt-8 w-full min-h-[44px] flex items-center justify-center text-[15px] ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('workout.discardWorkout')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (() => {
          const mutedClass = isDark ? 'text-ink/45' : 'text-ink-lt/45';
          const renderEntry = (s, key, onClick) => (
            <button key={key} onClick={onClick} className={`w-full text-left p-4 rounded-[10px] border active:scale-[0.98] transition-transform ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[14px] font-semibold text-accent-300">{t(`workout.type${s.type}`)}</span>
                <span className={`text-[13.5px] ${mutedClass}`}>{s.duration ? `${formatDuration(s.duration, t)} · ` : ''}{new Date(s.date).toLocaleDateString()}</span>
              </div>
              <div className="space-y-2">{s.exercises.map(ex => (
                <div key={ex.id} className="flex justify-between text-[15px] items-center">
                  <span className={`text-[12px] uppercase ${mutedClass}`}>{t('exercises.' + ex.id)}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{ex.weight}kg</span>
                    <div className="flex gap-0.5">{ex.setsCompleted.map((r, ri) => (
                      <div key={ri} className={r === targetReps(ex, ri) ? 'w-1.5 h-1.5 rounded-full bg-accent' : `w-1.5 h-1.5 rounded-full border ${isDark ? 'border-ink/30' : 'border-ink-lt/30'}`} />
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
              <h2 className="text-[24px] font-medium">{t('log.title')}</h2>
              <button
                onClick={() => {
                  const type = currentWorkoutType;
                  const workout = {
                    date: new Date().toISOString(),
                    type,
                    exercises: getProgramExercises(type, program).map(ex => ({ ...ex, weight: weights[ex.id], setsCompleted: new Array(ex.sets).fill(ex.reps) })),
                  };
                  setEditingEntry({ index: -1, session: workout });
                }}
                aria-label="Add workout"
                className={`w-10 h-10 rounded-lg border flex items-center justify-center active:scale-90 transition-transform ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}
              ><Plus size={18} /></button>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className={i < stats.thisWeek ? 'w-2 h-2 rounded-full bg-accent' : `w-2 h-2 rounded-full border ${isDark ? 'border-ink/30' : 'border-ink-lt/30'}`} />
                ))}
              </div>
              <span className={`text-[13.5px] ${mutedClass}`}>{stats.thisWeek >= 3 ? t('log.weekDone') : t('log.toGo', { count: 3 - stats.thisWeek })}</span>
              <span className={mutedClass}>·</span>
              <span className={`text-[13.5px] ${mutedClass}`}>{t('header.streak', { count: stats.streak })}</span>
              <span className={mutedClass}>·</span>
              <span className={`text-[13.5px] ${mutedClass}`}>{stats.total} {t('log.total')}</span>
            </div>

            {history.length > 0 && (
              <div className={`flex rounded-lg border overflow-hidden mb-2 ${isDark ? 'border-ink/10' : 'border-ink-lt/10'}`}>
                {[{ label: t('log.all'), val: 'all' }, { label: t('log.week'), val: 'week' }, { label: t('log.month'), val: 'month' }, { label: t('log.year'), val: 'year' }].map((opt, i) => (
                  <button
                    key={opt.val}
                    onClick={() => { setLogGrouping(opt.val); if (opt.val !== 'all') { const groups = groupHistory(history, opt.val, 0); setExpandedGroups(groups.length > 0 ? { [groups[0].key]: true } : {}); } else { setExpandedGroups({}); } }}
                    className={`flex-1 py-3 text-[12px] uppercase tracking-wide transition-all ${i > 0 ? (isDark ? 'border-l border-ink/10' : 'border-l border-ink-lt/10') : ''} ${logGrouping === opt.val ? 'bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_#9184d9]' : mutedClass}`}
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
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-[10px] border transition-all active:scale-[0.99] ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}
                  >
                    <div className="flex items-center gap-3">
                      {expandedGroups[group.key] ? <CaretDown size={18} className={mutedClass} /> : <CaretRight size={18} className={mutedClass} />}
                      <span className="text-[15px] font-medium">{group.key}</span>
                    </div>
                    <span className={`text-[13.5px] px-2.5 py-1 rounded-lg ${isDark ? 'bg-surface-deep text-ink/60' : 'bg-surface-deep-lt text-ink-lt/60'}`}>{group.entries.length}</span>
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
          const mutedClass = isDark ? 'text-ink/45' : 'text-ink-lt/45';
          const cardClass = `w-full p-4 rounded-[10px] border flex justify-between items-center active:scale-[0.98] transition-transform ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`;
          const trendIconFor = (trend) => trend === 'up' ? { Icon: TrendUp, className: 'text-accent' } : trend === 'down' ? { Icon: TrendDown, className: mutedClass } : { Icon: ArrowRight, className: isDark ? 'text-ink/40' : 'text-ink-lt/40' };
          return (
          <div className="space-y-6">
            {history.length === 0 ? (
              <div className="py-20 text-center px-10">
                <h2 className="text-lg font-semibold mb-2">{t('stats.noStats')}</h2>
                <p className={`text-[15px] leading-relaxed ${mutedClass}`}>{t('stats.noStatsBody')}</p>
              </div>
            ) : statsView ? (
              <StatsChart exerciseId={statsView} history={history} isDark={isDark} onBack={() => setStatsView(null)} weights={weights} best1RMs={best1RMs} />
            ) : (
              <>
                <h2 className="text-[24px] font-medium mb-4">{t('stats.title')}</h2>
                {(() => {
                  const big3Trend = getBig3Trend(history);
                  const { Icon: TrendIcon, className: trendClass } = trendIconFor(big3Trend);
                  return (
                    <button onClick={() => setStatsView('big3')} className={cardClass}>
                      <div className="text-left">
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent mb-1">{t('stats.big3Total')}</p>
                        <p className="text-[24px] font-medium tabular-nums">{big3Total}kg</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {big3Trend && <TrendIcon size={18} className={trendClass} />}
                        <CaretRight size={18} className={mutedClass} />
                      </div>
                    </button>
                  );
                })()}
                <div className="grid gap-3">{(preset === 'madcow' ? ['squat', 'bench', 'row', 'deadlift', mcPress] : EXPECTED_WEIGHT_KEYS).map(id => {
                  const trend = getExerciseTrend(history, id);
                  const { Icon: TrendIcon, className: trendClass } = trendIconFor(trend);
                  const hasData = history.some(s => s.exercises?.some(e => e.id === id));
                  return (
                    <button key={id} onClick={() => setStatsView(id)} className={cardClass}>
                      <div className="min-w-0 pr-2 text-left">
                        <p className="text-[15px] font-medium truncate">{t('exercises.' + id)}</p>
                        {hasData ? (
                          <p className={`text-[12px] uppercase leading-none mt-1 ${mutedClass}`}>{t('stats.est1rmValue', { value: best1RMs[id] || weights[id] })}</p>
                        ) : (
                          <p className={`text-[12px] leading-snug mt-1 ${mutedClass}`}>{t('stats.noSessionsForLift')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {trend && <TrendIcon size={18} className={trendClass} />}
                        <span className="text-accent-300 tabular-nums">{weights[id]}kg</span>
                        <CaretRight size={18} className={mutedClass} />
                      </div>
                    </button>
                  );
                })}
                </div>
              </>
            )}
          </div>
          );
        })()}

        {activeTab === 'program' && (
          <ProgramTab
            isDark={isDark} isWorkoutActive={isWorkoutActive} preset={preset}
            program={program} onChangeProgram={setProgram} weights={weights} history={history}
            mcTop={mcTop} mcWeek={mcWeek} mcInterval={mcInterval} mcPress={mcPress}
            onUpdateMcTop={updateMcTop} onChangeMcInterval={setMcInterval} onChangeMcPress={setMcPress}
            onRecalculate={() => setMcInterval(MADCOW_DEFAULT_INTERVAL)}
            currentWorkoutType={currentWorkoutType} mcNextDay={mcNextDay}
            programSheet={programSheet} setProgramSheet={setProgramSheet} onSwitchProgram={switchProgram}
          />
        )}

        {activeTab === 'settings' && (() => {
          const mutedClass = isDark ? 'text-ink/45' : 'text-ink-lt/45';
          const cardClass = `p-4 rounded-[10px] border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`;
          const innerRowClass = isDark ? 'rule-fade' : 'rule-fade-lt';
          const Switch = ({ checked, onChange, ariaLabel }) => (
            <button
              onClick={onChange}
              role="switch"
              aria-checked={checked}
              aria-label={ariaLabel}
              className={`w-[46px] h-[26px] rounded-full border relative shrink-0 transition-colors ${checked ? 'border-accent bg-accent-900' : (isDark ? 'border-ink/18' : 'border-ink-lt/18')}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${checked ? `translate-x-[21px] bg-accent` : `translate-x-0 ${isDark ? 'bg-ink/45' : 'bg-ink-lt/45'}`}`} />
            </button>
          );
          const Segmented = ({ options, value, onChange }) => (
            <div className={`flex rounded-lg border overflow-hidden ${isDark ? 'border-ink/10' : 'border-ink-lt/10'}`}>
              {options.map((opt, i) => (
                <button
                  key={opt.val}
                  onClick={() => onChange(opt.val)}
                  className={`flex-1 py-3 text-[12px] uppercase tracking-wide transition-all ${i > 0 ? (isDark ? 'border-l border-ink/10' : 'border-l border-ink-lt/10') : ''} ${value === opt.val ? 'bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_#9184d9]' : mutedClass}`}
                >{opt.label}</button>
              ))}
            </div>
          );
          return (
          <div className="space-y-6">
            <h2 className="text-[24px] font-medium mb-6">{t('options.title')}</h2>
            <div className={cardClass}>
              <div className="mb-4">
                <p className="text-[15px] font-semibold">{t('options.restInterval')}</p>
                <p className={`text-[12px] uppercase leading-tight ${mutedClass}`}>{t('options.restIntervalDesc')}</p>
              </div>
              <Segmented
                options={[{ label: '1:30', val: 90 }, { label: '3:00', val: 180 }, { label: '5:00', val: 300 }]}
                value={preferredRest}
                onChange={setPreferredRest}
              />
            </div>

            <div className={cardClass}>
              <div className={`flex items-center justify-between pb-4 mb-4 ${innerRowClass}`}>
                <div><p className="text-[15px] font-semibold">{t('options.soundAlert')}</p><p className={`text-[12px] uppercase leading-tight ${mutedClass}`}>{t('options.soundAlertDesc')}</p></div>
                <Switch checked={soundEnabled} onChange={() => setSoundEnabled(!soundEnabled)} ariaLabel="Sound alert" />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-[15px] font-semibold">{t('options.vibration')}</p><p className={`text-[12px] uppercase leading-tight ${mutedClass}`}>{t('options.vibrationDesc')}</p></div>
                <Switch checked={vibrationEnabled} onChange={() => setVibrationEnabled(!vibrationEnabled)} ariaLabel="Vibration" />
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div><p className="text-[15px] font-semibold">{t('options.darkMode')}</p><p className={`text-[12px] uppercase leading-tight ${mutedClass}`}>{t('options.darkModeDesc')}</p></div>
                <Switch checked={isDark} onChange={() => setIsDark(!isDark)} ariaLabel="Dark mode" />
              </div>
            </div>

            {/* Backup & Sync */}
            <div className={cardClass}>
              <div className={`pb-4 mb-4 ${innerRowClass}`}>
                <p className="text-[15px] font-semibold">{t('options.backupSync')}</p>
                <p className={`text-[12px] uppercase leading-tight ${mutedClass}`}>{t('options.backupSyncDesc')}</p>
              </div>

              {/* Local Backup toggle */}
              <div className={`flex items-center justify-between pb-4 mb-4 ${innerRowClass}`}>
                <div><p className="text-[13.5px] font-medium">{t('options.localBackup')}</p><p className={`text-[12px] leading-tight ${mutedClass}`}>{t('options.localBackupDesc')}</p></div>
                <Switch checked={localBackup} onChange={() => setLocalBackup(!localBackup)} ariaLabel="Local backup" />
              </div>

              {/* Google Drive section */}
              {driveConfigured && (
                <div className={`pb-4 mb-4 ${innerRowClass}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div><p className="text-[13.5px] font-medium">{t('options.googleDrive')}</p><p className={`text-[12px] leading-tight ${mutedClass}`}>{t('options.googleDriveDesc')}</p></div>
                    {gdrive.isConnected ? (
                      <span className={`text-[12px] uppercase px-2.5 py-1.5 rounded-lg text-accent-300 bg-accent-900`}>{t('options.connectedToDrive')}</span>
                    ) : (
                      <button onClick={handleConnect} className={`text-[12px] uppercase px-3.5 py-2.5 rounded-lg border active:scale-95 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}>{gdrive.hasEverConnected ? t('options.reconnectDrive') : t('options.connectDrive')}</button>
                    )}
                  </div>
                  {(gdrive.isConnected || gdrive.hasEverConnected) && (
                    <div className="mt-3 space-y-2">
                      <p className={`text-[12px] leading-tight ${mutedClass}`}>{t('options.savesAfterWorkout')}</p>
                      <div className="flex items-center justify-between">
                        {gdrive.saveFailed ? (
                          <button onClick={handleDriveSave} className={`text-[12px] active:scale-95 ${mutedClass}`}>{t('options.saveFailed')}</button>
                        ) : gdrive.lastSavedAt ? (
                          <p className="text-[12px] text-accent">{t('options.lastSaved', { time: formatLastSaved(gdrive.lastSavedAt) })}</p>
                        ) : <span />}
                        <button onClick={handleDriveSave} disabled={gdrive.isLoading} className={`text-[12px] uppercase px-3.5 py-2.5 rounded-lg border active:scale-95 disabled:opacity-35 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}>{t('options.syncNow')}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Backup & Restore buttons */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={() => exportData()} className="py-3.5 rounded-lg border border-accent text-accent flex flex-col items-center gap-2 text-[12px] uppercase active:scale-95 transition-transform">
                  <DownloadSimple size={20} /> {t('options.backupToDevice')}
                </button>
                <button onClick={() => fileInputRef.current?.click()} className={`py-3.5 rounded-lg border flex flex-col items-center gap-2 text-[12px] uppercase active:scale-95 transition-transform ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}>
                  <UploadSimple size={20} /> {t('options.restore')}
                </button>
              </div>
              <button onClick={() => csvInputRef.current?.click()} className={`w-full py-3.5 rounded-lg border flex items-center justify-center gap-2 text-[12px] uppercase active:scale-95 transition-transform ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}>
                <FileCsv size={20} /> {t('options.importStronglifts')}
              </button>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div><p className="text-[15px] font-semibold">{t('options.language')}</p><p className={`text-[12px] uppercase leading-tight ${mutedClass}`}>{t('options.languageDesc')}</p></div>
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
              <span className="flex items-center gap-2 text-[13.5px] tabular-nums">
                <Play size={13} weight="fill" />
                {liveDetail}
              </span>
              <span className="flex items-center gap-1 text-[13.5px]">
                {t('liveWorkout.return')} <CaretRight size={12} />
              </span>
            </button>
          </div>
        );
      })()}

      <nav className={`flex-none border-t flex justify-between px-2 pt-1.5 nav-safe ${isDark ? 'bg-surface-nav border-ink/8' : 'bg-surface-nav-lt border-ink-lt/8'}`}>
        {[
          { id: 'workout', label: t('tabs.train'), icon: Barbell },
          { id: 'program', label: t('tabs.program'), icon: SlidersHorizontal },
          { id: 'history', label: t('tabs.log'), icon: ListChecks },
          { id: 'progress', label: t('tabs.stats'), icon: ChartLineUp },
          { id: 'settings', label: t('tabs.options'), icon: Gear },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const colorClass = isActive ? 'text-accent-300' : (isDark ? 'text-ink/35' : 'text-ink-lt/35');
          return (
            <button key={tab.id} onClick={() => handleTabClick(tab.id)} aria-label={tab.label} className={`flex-1 flex flex-col items-center gap-1 py-1.5 px-2.5 transition-all active:scale-95 ${colorClass}`}>
              <tab.icon size={23} weight={isActive ? 'fill' : 'regular'} />
              <span className="text-[11px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {showCancelModal && (
        <div role="dialog" aria-modal="true" aria-label="Discard workout" className="fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-xs flex flex-col items-center p-6 rounded-xl border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <h3 className="text-lg font-semibold mb-3">{t('modals.discardTitle')}</h3>
            <p className={`text-[15px] leading-relaxed mb-6 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{t('modals.discardBody')}</p>
            <button onClick={() => setShowCancelModal(false)} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 mb-6">{t('modals.keepLifting')}</button>
            <button onClick={cancelWorkout} className={`w-full min-h-[44px] flex items-center justify-center text-[15px] active:scale-90 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.yesDiscard')}</button>
          </div>
        </div>
      )}

      {deloadAlert && (() => {
        const previewWeights = calculateDeload(weights, deloadPercent);
        return (
        <div role="dialog" aria-modal="true" aria-label="Deload recommendation" className="fixed inset-0 z-[400] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-sm rounded-xl p-6 border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <h3 className="text-lg font-semibold mb-3">{t('modals.acceptDeload')}</h3>
            <p className={`text-[15px] leading-relaxed mb-6 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{deloadAlert.message}</p>
            <div className="mb-4">
              <p className="text-[24px] font-semibold mb-1">{t('modals.deloadPercent', { percent: deloadPercent })}</p>
              <p className={`text-[12px] ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.deloadRecommended', { percent: deloadAlert.recommended })}</p>
            </div>
            <input type="range" min={10} max={90} step={5} value={deloadPercent} onChange={e => setDeloadPercent(Number(e.target.value))} className="w-full mb-6 accent-accent" />
            <div className="space-y-2 mb-6">
              {EXPECTED_WEIGHT_KEYS.filter(id => weights[id] > 0).map(id => (
                <div key={id} className={`flex justify-between items-center px-4 py-3 rounded-lg ${isDark ? 'bg-surface-deep' : 'bg-surface-deep-lt'}`}>
                  <span className={`text-[12px] uppercase ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('exercises.' + id)}</span>
                  <span className="text-[15px] tabular-nums">{weights[id]}kg <span className="text-accent mx-1">&rarr;</span> {previewWeights[id]}kg</span>
                </div>
              ))}
            </div>
            <button onClick={() => {
              const newW = calculateDeload(weights, deloadPercent);
              const lastWorkoutDate = history[0]?.date;
              if (lastWorkoutDate) {
                setLongBreakDeloadForDate(lastWorkoutDate);
                localStorage.setItem(LONG_BREAK_DELOAD_KEY, lastWorkoutDate);
              }
              setWeights(newW);
              initializeWorkout(newW);
              setDeloadAlert(null);
            }} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 mb-6">{t('modals.acceptAndLift')}</button>
            <button onClick={() => { initializeWorkout(weights); setDeloadAlert(null); }} className={`w-full min-h-[44px] flex items-center justify-center text-[15px] active:scale-90 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.skipDeload')}</button>
          </div>
        </div>
        );
      })()}

      {showRestorePrompt && (
        <div role="dialog" aria-modal="true" aria-label="Restore backup" className="fixed inset-0 z-[300] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-sm rounded-xl p-6 border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <h3 className="text-lg font-semibold mb-2">{t('modals.syncHistory')}</h3>
            <p className={`text-[15px] leading-relaxed mb-8 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{t('modals.syncHistoryBody')}</p>
            <div className="space-y-3">
              <button onClick={() => fileInputRef.current?.click()} className="w-full h-12 rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 flex items-center justify-center gap-2"><UploadSimple size={18} /> {t('modals.restoreBackup')}</button>
              {driveConfigured && (
                <button onClick={handleConnect} className={`w-full h-[46px] rounded-lg font-medium text-[14px] active:scale-95 border flex items-center justify-center gap-2 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}><Cloud size={18} /> {t('modals.restoreFromDrive')}</button>
              )}
              <button onClick={() => csvInputRef.current?.click()} className={`w-full h-[46px] rounded-lg font-medium text-[14px] active:scale-95 border flex items-center justify-center gap-2 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}><FileCsv size={18} /> {t('options.importStronglifts')}</button>
              <button onClick={() => startWorkout(true)} className={`text-[15px] mt-4 block mx-auto ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.skipAndStart')}</button>
            </div>
          </div>
        </div>
      )}

      {showResumePrompt && saved.activeSession && (
        <div role="dialog" aria-modal="true" aria-label="Resume workout" className="fixed inset-0 z-[350] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-sm rounded-xl p-6 border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <h3 className="text-lg font-semibold mb-2">{t('modals.resumeWorkout')}</h3>
            <p className={`text-[15px] leading-relaxed mb-1 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{t('modals.inProgress', { name: t(`workout.type${saved.activeSession.session.type}`) })}</p>
            <p className={`text-[13.5px] mb-8 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>
              {t('modals.setsCompleted', { completed: saved.activeSession.session.exercises.reduce((n, ex) => n + ex.setsCompleted.filter(s => s !== null).length, 0), total: saved.activeSession.session.exercises.reduce((n, ex) => n + ex.setsCompleted.length, 0) })}
            </p>
            <button
              onClick={() => {
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
              className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 mb-6"
            >{t('modals.resume')}</button>
            <button
              onClick={() => {
                localStorage.removeItem(ACTIVE_WORKOUT_KEY);
                setShowResumePrompt(false);
              }}
              className={`w-full min-h-[44px] flex items-center justify-center text-[15px] active:scale-90 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}
            >{t('modals.discard')}</button>
          </div>
        </div>
      )}

      {repPicker && (
        <RepPicker
          ex={repPicker.ex}
          setIdx={repPicker.setIdx}
          isDark={isDark}
          onSelect={handleSetReps}
          onClose={() => setRepPicker(null)}
        />
      )}

      {workoutPicker && (() => {
        const isMadcow = preset === 'madcow';
        const options = isMadcow ? MADCOW_DAYS : ['A', 'B'];
        const currentValue = isMadcow ? mcNextDay : currentWorkoutType;
        return (
          <div role="dialog" aria-modal="true" aria-label={t('workout.todaysWorkout')} onClick={() => setWorkoutPicker(false)} className="fixed inset-0 z-[400] flex items-end justify-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
            <div onClick={e => e.stopPropagation()} className={`w-full max-w-md rounded-t-[14px] pt-[22px] px-5 pb-6 ${isDark ? 'bg-surface' : 'bg-surface-lt'}`}>
              <h3 className="text-lg font-semibold mb-5">{t('workout.todaysWorkout')}</h3>
              <div className="space-y-3 mb-5">
                {options.map(day => {
                  const isCurrent = day === currentValue;
                  const liftIds = isMadcow ? getMadcowDayLiftIds(day, mcPress) : getProgramExercises(day, program).map(ex => ex.id);
                  const dayExercises = isMadcow ? getMadcowDayExercises(day, mcTop, mcInterval, mcPress) : getProgramExercises(day, program).map(ex => ({ ...ex, weight: weights[ex.id] }));
                  const dayWeights = dayExercises.map(ex => (isMadcow ? Math.max(...ex.setWeights) : ex.weight));
                  return (
                    <button
                      key={day}
                      onClick={() => { if (isMadcow) setMcNextDay(day); else setCurrentWorkoutType(day); setWorkoutPicker(false); }}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-[10px] border text-left active:scale-[0.99] transition-transform ${isCurrent ? 'border-accent bg-accent-900' : (isDark ? 'border-ink/12' : 'border-ink-lt/12')}`}
                    >
                      <span className={`w-9 h-9 rounded-lg border flex items-center justify-center font-semibold shrink-0 ${isCurrent ? 'border-accent text-accent-300' : (isDark ? 'border-ink/18' : 'border-ink-lt/18')}`}>{day}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-[14.5px]">{t(`workout.type${day}`)}</p>
                          {isMadcow && <span className="text-[10.5px] uppercase tracking-wide px-2 py-0.5 rounded-lg text-accent-300 bg-accent-900">{moodLabel(day)}</span>}
                        </div>
                        <p className={`text-[12.5px] truncate ${isDark ? 'text-ink/50' : 'text-ink-lt/50'}`}>{liftIds.map(id => t('exercises.' + id)).join(' · ')}</p>
                        <p className={`text-[12px] tabular-nums ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{dayWeights.join(' · ')} kg</p>
                      </div>
                      {isCurrent && <Check size={18} className="text-accent-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <p className={`text-[12px] text-center mb-5 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('workout.scheduledNote')}</p>
              <button onClick={() => setWorkoutPicker(false)} className={`w-full h-[46px] flex items-center justify-center rounded-lg border text-[14px] font-medium active:scale-95 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}>{t('modals.cancel')}</button>
            </div>
          </div>
        );
      })()}

      {pendingCSVImport && (
        <div role="dialog" aria-modal="true" aria-label="Confirm StrongLifts import" className="fixed inset-0 z-[300] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-sm rounded-xl p-6 border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <h3 className="text-lg font-semibold mb-2">{t('modals.importData')}</h3>
            <p className={`text-[15px] leading-relaxed mb-6 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{t('modals.foundWorkouts', { count: pendingCSVImport.history.length })}</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {EXPECTED_WEIGHT_KEYS.map(id => (
                <div key={id} className={`p-3 rounded-lg text-left ${isDark ? 'bg-surface-deep' : 'bg-surface-deep-lt'}`}>
                  <p className={`text-[12px] uppercase leading-none mb-1 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('exercises.' + id)}</p>
                  <p className="text-[15px] tabular-nums">{pendingCSVImport.weights[id]}kg</p>
                </div>
              ))}
            </div>
            <button onClick={applyCSVImport} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 mb-3">{t('modals.import')}</button>
            <button onClick={() => setPendingCSVImport(null)} className={`text-[15px] active:scale-90 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.cancel')}</button>
          </div>
        </div>
      )}

      {editingEntry && (() => {
        const isNewEntry = editingEntry.index === -1;
        const selectedDate = editingEntry.session.date.slice(0, 10);
        const originalDate = !isNewEntry ? history[editingEntry.index]?.date.slice(0, 10) : null;
        const dateConflict = selectedDate !== originalDate && historyDateSet.has(selectedDate);
        const isFutureDate = selectedDate > new Date().toISOString().slice(0, 10);
        return (
        <div role="dialog" aria-modal="true" aria-label={isNewEntry ? 'Add workout' : 'Edit workout'} className="fixed inset-0 z-[250] flex items-start justify-center overflow-y-auto overscroll-contain backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-md mx-auto my-6 rounded-xl p-6 border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">{isNewEntry ? t('modals.addWorkout') : t('modals.editWorkout')}</h3>
              <button onClick={() => { setEditingEntry(null); setShowDeleteConfirm(false); }} aria-label="Close edit modal" className={`w-10 h-10 rounded-lg border flex items-center justify-center ${isDark ? 'border-ink/15 text-ink' : 'border-ink-lt/15 text-ink-lt'}`}><X size={18} /></button>
            </div>

            {isNewEntry && (
              <div className="mb-6">
                <label className={`text-[12px] uppercase tracking-[0.12em] block mb-2 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.workoutType')}</label>
                <div className="flex gap-2">
                  {['A', 'B'].map(wt => (
                    <button
                      key={wt}
                      onClick={() => setEditingEntry(prev => ({
                        ...prev,
                        session: {
                          ...prev.session,
                          type: wt,
                          exercises: getProgramExercises(wt, program).map(ex => ({ ...ex, weight: weights[ex.id], setsCompleted: new Array(ex.sets).fill(ex.reps) })),
                        },
                      }))}
                      className={`flex-1 py-3 rounded-lg text-[15px] font-medium transition-all border ${editingEntry.session.type === wt ? 'border-accent text-accent bg-accent-900' : (isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60')}`}
                    >{t(`workout.type${wt}`)}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className={`text-[12px] uppercase tracking-[0.12em] block mb-2 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.date')}</label>
              <input
                type="date"
                value={editingEntry.session.date.slice(0, 10)}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  newDate.setHours(12, 0, 0, 0);
                  setEditingEntry(prev => ({ ...prev, session: { ...prev.session, date: newDate.toISOString() } }));
                }}
                className={`w-full p-3 rounded-lg text-[15px] border ${dateConflict || isFutureDate ? 'border-dashed border-ink/50' : (isDark ? 'border-ink/18' : 'border-ink-lt/18')} ${isDark ? 'bg-surface-deep text-ink' : 'bg-surface-deep-lt text-ink-lt'}`}
              />
              {dateConflict && <p className={`text-[13.5px] mt-2 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{t('modals.dateConflict')}</p>}
              {isFutureDate && <p className={`text-[13.5px] mt-2 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{t('modals.futureDate')}</p>}
            </div>

            <div className="space-y-3 mb-6">
              {editingEntry.session.exercises.map((ex, exIdx) => (
                <div key={ex.id} className={`p-4 rounded-lg border ${isDark ? 'bg-surface-deep border-ink/8' : 'bg-surface-deep-lt border-ink-lt/8'}`}>
                  <p className="text-[13.5px] font-medium mb-3">{t('exercises.' + ex.id)}</p>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-[12px] uppercase ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.weightLabel')}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingEntry(prev => {
                          const s = JSON.parse(JSON.stringify(prev.session));
                          s.exercises[exIdx].weight = Math.max(0, s.exercises[exIdx].weight - 2.5);
                          return { ...prev, session: s };
                        })}
                        aria-label={`Decrease ${ex.name} weight`}
                        className={`w-10 h-10 rounded-lg border flex items-center justify-center ${isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60'} active:scale-90`}
                      ><Minus size={16} /></button>
                      <span className="w-14 text-center text-[15px] tabular-nums">{ex.weight}kg</span>
                      <button
                        onClick={() => setEditingEntry(prev => {
                          const s = JSON.parse(JSON.stringify(prev.session));
                          s.exercises[exIdx].weight += 2.5;
                          return { ...prev, session: s };
                        })}
                        aria-label={`Increase ${ex.name} weight`}
                        className={`w-10 h-10 rounded-lg border flex items-center justify-center ${isDark ? 'border-ink/18 text-ink/60' : 'border-ink-lt/18 text-ink-lt/60'} active:scale-90`}
                      ><Plus size={16} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-[12px] uppercase ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.setsLabel')}</span>
                    <div className="flex gap-2">
                      {ex.setsCompleted.map((reps, setIdx) => {
                        const target = targetReps(ex, setIdx);
                        const stateClass = reps === null
                          ? (isDark ? 'border border-ink/18 text-ink/40' : 'border border-ink-lt/18 text-ink-lt/40')
                          : reps === target
                            ? 'border border-accent bg-accent-900 text-accent-300'
                            : 'border border-dashed border-ink/50 bg-neutral-tint text-ink';
                        return (
                          <button
                            key={setIdx}
                            onClick={() => setEditingEntry(prev => {
                              const s = JSON.parse(JSON.stringify(prev.session));
                              const cur = s.exercises[exIdx].setsCompleted[setIdx];
                              s.exercises[exIdx].setsCompleted[setIdx] = cur === null ? target : cur === 0 ? null : cur - 1;
                              return { ...prev, session: s };
                            })}
                            aria-label={`Set ${setIdx + 1}: ${reps === null ? 'not done' : reps + ' reps'}`}
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-[13.5px] font-medium active:scale-90 transition-transform ${stateClass}`}
                          >
                            {reps === null ? '–' : reps}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              disabled={dateConflict || isFutureDate}
              onClick={() => {
                const unsortedHistory = isNewEntry
                  ? [...history, editingEntry.session]
                  : history.map((s, i) => i === editingEntry.index ? editingEntry.session : s);
                const newHistory = [...unsortedHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
                const savedIndex = newHistory.findIndex(s => s === editingEntry.session);
                const isLatestEntry = savedIndex === 0;

                let nextWeights = weights;
                let nextType = currentWorkoutType;

                if (isLatestEntry) {
                  const priorHistory = newHistory.slice(1);
                  const { nextWeights: adjustedWeights } = evaluateWorkoutOutcome(editingEntry.session, priorHistory, weights);
                  nextWeights = adjustedWeights;
                  nextType = editingEntry.session.type === 'A' ? 'B' : 'A';

                  setWeights(adjustedWeights);
                  setCurrentWorkoutType(nextType);
                }

                setHistory(newHistory);
                showToast(t(isNewEntry ? 'toast.workoutAdded' : 'toast.workoutUpdated'), 'success');
                setEditingEntry(null);
                handleManualLogSave({ history: newHistory, weights: nextWeights, nextType });
              }}
              className={`w-full h-12 flex items-center justify-center rounded-lg border text-[14.5px] font-medium mb-6 ${dateConflict || isFutureDate ? (isDark ? 'border-ink/12 text-ink/30' : 'border-ink-lt/12 text-ink-lt/30') : 'border-accent text-accent active:scale-95'}`}
            >{isNewEntry ? t('modals.addWorkout') : t('modals.saveChanges')}</button>

            {!isNewEntry && (
              !showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className={`w-full min-h-[44px] flex items-center justify-center gap-2 text-[15px] active:scale-90 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}
                ><Trash size={14} /> {t('modals.deleteWorkout')}</button>
              ) : (
                <div className={`p-4 rounded-lg border border-dashed ${isDark ? 'border-ink/30' : 'border-ink-lt/30'}`}>
                  <p className="text-[13.5px] text-center mb-3">{t('modals.deleteConfirm')}</p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        const newHistory = history.filter((_, idx) => idx !== editingEntry.index);
                        setHistory(newHistory);
                        setEditingEntry(null);
                        setShowDeleteConfirm(false);
                        showToast(t('toast.workoutDeleted'), 'success');
                        saveToDriveQuietly({ ...getAppState(), history: newHistory });
                      }}
                      className={`flex-1 h-[46px] flex items-center justify-center rounded-lg border text-[14px] font-medium active:scale-95 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}
                    >{t('modals.delete')}</button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className={`flex-1 h-[46px] flex items-center justify-center text-[14px] active:scale-95 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}
                    >{t('modals.cancel')}</button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
        );
      })()}

      {completionSummary && (() => {
        const totalTime = formatClock(completionSummary.workout.duration);
        return (
        <div role="dialog" aria-modal="true" aria-label="Workout complete" className="fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-sm rounded-xl p-6 border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent mb-4">{t('completion.kicker')}</p>
            {totalTime && (
              <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg mb-5 ${isDark ? 'bg-surface-deep' : 'bg-surface-deep-lt'}`}>
                <span className={`text-[12px] uppercase ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('completion.totalTime')}</span>
                <span className="text-[15px] tabular-nums">{totalTime}</span>
              </div>
            )}
            <div className="space-y-3 mb-6">
              {completionSummary.workout.exercises.map(ex => {
                const passed = isExercisePassed(ex);
                const progressed = completionSummary.progressions.includes(ex.id);
                const nextWeight = completionSummary.nextWeights?.[ex.id];
                const mutedColor = isDark ? 'text-ink/45' : 'text-ink-lt/45';
                const setDurations = ex.setDurations ?? [];
                const logged = setDurations.filter(d => typeof d === 'number');
                const hasSplits = logged.length > 0;
                const exerciseTime = hasSplits ? formatClock(logged.reduce((sum, d) => sum + d, 0)) : null;
                return (
                  <div key={ex.id} className={`p-3 rounded-lg border ${isDark ? 'bg-surface-deep border-ink/8' : 'bg-surface-deep-lt border-ink-lt/8'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-medium">{t('exercises.' + ex.id)}</span>
                      {progressed ? (
                        <span className="flex items-center gap-1 text-[13.5px] text-accent"><TrendUp size={14} />{t('completion.progressedTo', { from: ex.weight, to: nextWeight })}</span>
                      ) : (
                        <span className={`flex items-center gap-1 text-[13.5px] ${mutedColor}`}><ArrowRight size={14} />{t('completion.staysAt', { weight: ex.weight })}</span>
                      )}
                    </div>
                    <div className="flex justify-start gap-1.5 mt-2.5">
                      {ex.setsCompleted.map((r, i) => {
                        const val = r ?? 0;
                        const failed = val < targetReps(ex, i);
                        const split = formatClock(setDurations[i]);
                        return (
                          <div
                            key={i}
                            style={{ width: `calc((100% - ${6 * (MAX_SETS - 1)}px) / ${MAX_SETS})` }}
                            className={`shrink-0 max-w-[3.5rem] rounded-lg py-1.5 ${isDark ? 'bg-surface' : 'bg-surface-lt'}`}
                          >
                            <div className={`text-[13.5px] leading-none ${failed && !passed ? 'text-ink' : (isDark ? 'text-ink/70' : 'text-ink-lt/70')}`}>{val}</div>
                            {hasSplits && <div className={`text-[12px] tabular-nums leading-none mt-1 ${mutedColor}`}>{split ?? '–'}</div>}
                          </div>
                        );
                      })}
                    </div>
                    {exerciseTime && <p className={`text-[12px] tabular-nums mt-2 ${mutedColor}`}>{t('completion.exerciseTime', { time: exerciseTime })}</p>}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setCompletionSummary(null)} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95">{t('completion.done')}</button>
          </div>
        </div>
        );
      })()}

      {pendingFailureDeloads && (() => {
        const previewDeloads = pendingFailureDeloads.map(d => ({
          ...d,
          newWeight: deloadWeightByPercent(d.currentWeight, deloadPercent, d.id),
        }));
        return (
        <div role="dialog" aria-modal="true" aria-label="Failure deload" className="fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-sm rounded-xl p-6 border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <h3 className="text-lg font-semibold mb-3">{t('modals.failureDeloadTitle')}</h3>
            <p className={`text-[15px] leading-relaxed mb-6 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{t('modals.failureDeloadMessage')}</p>
            <div className="mb-4">
              <p className="text-[24px] font-semibold mb-1">{t('modals.deloadPercent', { percent: deloadPercent })}</p>
              <p className={`text-[12px] ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.deloadRecommended', { percent: 10 })}</p>
            </div>
            <input type="range" min={10} max={90} step={5} value={deloadPercent} onChange={e => setDeloadPercent(Number(e.target.value))} className="w-full mb-6 accent-accent" />
            <div className="space-y-2 mb-6">
              {previewDeloads.map(d => (
                <div key={d.id} className={`flex justify-between items-center px-4 py-3 rounded-lg ${isDark ? 'bg-surface-deep' : 'bg-surface-deep-lt'}`}>
                  <span className={`text-[12px] uppercase ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('exercises.' + d.id)}</span>
                  <span className="text-[15px] tabular-nums">{d.currentWeight}kg <span className="text-accent mx-1">&rarr;</span> {d.newWeight}kg</span>
                </div>
              ))}
            </div>
            <button onClick={() => {
              const updatedWeights = { ...weights };
              previewDeloads.forEach(d => { updatedWeights[d.id] = d.newWeight; });
              setWeights(updatedWeights);
              setPendingFailureDeloads(null);
              initializeWorkout(updatedWeights);
            }} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 mb-6">{t('modals.confirmDeload')}</button>
            <button onClick={() => {
              setPendingFailureDeloads(null);
              initializeWorkout(weights);
            }} className={`w-full min-h-[44px] flex items-center justify-center text-[15px] active:scale-90 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.skipDeload')}</button>
          </div>
        </div>
        );
      })()}

      {showHelp && (
        <div role="dialog" aria-modal="true" aria-label="How it works" onClick={() => setShowHelp(false)} className="fixed inset-0 z-[500] flex items-end justify-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div onClick={e => e.stopPropagation()} className={`w-full max-w-md rounded-t-[14px] pt-[22px] px-5 pb-6 ${isDark ? 'bg-surface' : 'bg-surface-lt'}`}>
            <h3 className="text-lg font-semibold mb-5">{t('help.title')}</h3>
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain space-y-5 mb-6 text-left">
              {[
                { Icon: Timer, title: t('help.restTitle'), body: t('help.restBody') },
                { Icon: Moon, title: t('help.longBreaksTitle'), body: t('help.longBreaksBody') },
                { Icon: Cloud, title: t('help.backupsTitle'), body: t('help.backupsBody') },
              ].map(({ Icon, title, body }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className={`w-[30px] h-[30px] rounded-lg border border-accent text-accent flex items-center justify-center shrink-0`}><Icon size={18} /></div>
                  <div><p className="text-[15px] font-medium">{title}</p><p className={`text-[13.5px] leading-relaxed ${isDark ? 'text-ink/55' : 'text-ink-lt/55'}`}>{body}</p></div>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setShowHelp(false); setActiveTab('program'); }}
              className={`w-full flex items-center justify-between p-4 rounded-[10px] border mb-3 active:scale-[0.99] transition-transform ${isDark ? 'bg-surface-deep border-ink/8' : 'bg-surface-deep-lt border-ink-lt/8'}`}
            >
              <span className="flex items-center gap-2 text-[14.5px] font-medium">
                <Barbell weight="fill" size={17} className="text-accent" /> {t('help.programLink')}
              </span>
              <span className="flex items-center gap-1 text-[13.5px] text-accent-300 shrink-0">
                {t(`program.strip.${preset}Name`)} <CaretRight size={14} />
              </span>
            </button>
            <button autoFocus onClick={() => setShowHelp(false)} className={`w-full h-[46px] flex items-center justify-center rounded-lg border text-[14px] font-medium active:scale-95 ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}>{t('help.gotIt')}</button>
          </div>
        </div>
      )}

      {pendingDriveRestore && (
        <div role="dialog" aria-modal="true" aria-label="Older backup warning" className="fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-sm rounded-xl p-6 border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <h3 className="text-lg font-semibold mb-3">{t('modals.olderBackupTitle')}</h3>
            <p className={`text-[15px] leading-relaxed mb-6 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{t('modals.olderBackupBody', { backupCount: pendingDriveRestore.backupCount, backupDate: pendingDriveRestore.backupDate, localCount: pendingDriveRestore.localCount, lossCount: pendingDriveRestore.lossCount })}</p>
            <button onClick={() => { applyDriveRestore(pendingDriveRestore.data); setPendingDriveRestore(null); }} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 mb-3">{t('modals.restoreAnyway')}</button>
            <button onClick={() => setPendingDriveRestore(null)} className={`text-[15px] active:scale-90 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.cancel')}</button>
          </div>
        </div>
      )}

      {pendingLocalImport && (
        <div role="dialog" aria-modal="true" aria-label="Older backup warning" className="fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-sm rounded-xl p-6 border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <h3 className="text-lg font-semibold mb-3">{t('modals.olderBackupTitle')}</h3>
            <p className={`text-[15px] leading-relaxed mb-6 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{t('modals.olderBackupBody', { backupCount: pendingLocalImport.backupCount, backupDate: pendingLocalImport.backupDate, localCount: pendingLocalImport.localCount, lossCount: pendingLocalImport.lossCount })}</p>
            <button onClick={() => applyLocalImport(pendingLocalImport.data)} className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 mb-3">{t('modals.restoreAnyway')}</button>
            <button onClick={() => setPendingLocalImport(null)} className={`text-[15px] active:scale-90 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.cancel')}</button>
          </div>
        </div>
      )}

      {connectSyncPrompt && (
        <div role="dialog" aria-modal="true" aria-label="Data conflict" className="fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-sm bg-[rgba(15,16,25,.75)]">
          <div className={`w-full max-w-sm rounded-xl p-6 border ${isDark ? 'bg-surface border-ink/8' : 'bg-surface-lt border-ink-lt/8'}`}>
            <h3 className="text-lg font-semibold mb-3">
              {t('modals.dataConflictTitle')}
            </h3>
            <p className={`text-[15px] leading-relaxed mb-6 ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>
              {t('modals.dataConflictBody', {
                driveCount: connectSyncPrompt.driveCount,
                cloudDate: connectSyncPrompt.cloudDate,
                localCount: connectSyncPrompt.localCount,
                localDate: connectSyncPrompt.localDate,
              })}
            </p>
            <div className="space-y-3 mb-4">
              <button
                onClick={async () => {
                  if (connectSyncPrompt.driveData) {
                    applyDriveRestore(connectSyncPrompt.driveData);
                    showToast(t('toast.restoredFromDrive'), 'success');
                  }
                  setConnectSyncPrompt(null);
                }}
                disabled={!connectSyncPrompt.driveData}
                className="w-full h-12 flex items-center justify-center rounded-lg border border-accent text-accent font-medium text-[14.5px] active:scale-95 disabled:opacity-35"
              >
                {t('modals.useDriveData')}
              </button>
              <button
                onClick={async () => {
                  const result = await gdrive.save(getAppState());
                  if (result.success) showToast(t('toast.savedToDrive'), 'success');
                  setConnectSyncPrompt(null);
                }}
                className={`w-full h-[46px] flex items-center justify-center rounded-lg font-medium text-[14px] active:scale-95 border ${isDark ? 'border-ink/18 text-ink' : 'border-ink-lt/18 text-ink-lt'}`}
              >
                {t('modals.useLocalData')}
              </button>
            </div>
            <button onClick={() => setConnectSyncPrompt(null)} className={`text-[15px] active:scale-90 ${isDark ? 'text-ink/45' : 'text-ink-lt/45'}`}>{t('modals.cancel')}</button>
          </div>
        </div>
      )}

      <Toast toasts={toasts} />
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
      <input type="file" ref={csvInputRef} onChange={handleStrongliftsImport} accept=".csv" className="hidden" />
    </div>
  );
};

export default App;
