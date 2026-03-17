import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Dumbbell, History, Settings as SettingsIcon, Play, TrendingUp,
  Plus, Minus, RefreshCw, Moon, X, Download, Upload,
  ToggleRight, ToggleLeft, AlertCircle, HelpCircle, Zap, TrendingDown,
  Clock, Vibrate, Trash2, Bell, ChevronRight, Menu, Timer,
  FileSpreadsheet, MoveRight, Flame, ChevronDown, CheckCircle2, MinusCircle, Trophy,
  Globe, Cloud, HardDrive, FolderSync
} from 'lucide-react';

import { useTranslation } from 'react-i18next';
import i18n from './i18n/index.js';
import { WORKOUTS, INITIAL_WEIGHTS, STORAGE_KEY, SCHEMA_VERSION, EXPECTED_WEIGHT_KEYS, MAX_IMPORT_SIZE, ACTIVE_WORKOUT_KEY } from './constants';
import { validateImportData, calculateBest1RM, calculatePlates, calculateDeload, deloadWeight, getConsecutiveFailures, formatDuration } from './utils';
import { convertStrongliftsCSV } from './utils/convertStronglifts';
import { getExerciseTrend, getBig3Trend, getWorkoutStats, groupHistory } from './utils/chartData';
import { useLoadSaved, useSyncStorage, useStorageSync } from './hooks/useLocalStorage';
import { useTimer } from './hooks/useTimer';
import RestTimer from './components/RestTimer';
import ExerciseCard from './components/ExerciseCard';
import StatsChart from './components/StatsChart';
import Toast from './components/Toast';
import { useToast } from './hooks/useToast';
import { useGoogleDrive } from './hooks/useGoogleDrive';

const App = () => {
  const { t } = useTranslation();
  const saved = useLoadSaved();
  const { toasts, showToast } = useToast();

  const [weights, setWeights] = useState(saved.weights ?? INITIAL_WEIGHTS);
  const [history, setHistory] = useState(Array.isArray(saved.history) ? saved.history : []);
  const [currentWorkoutType, setCurrentWorkoutType] = useState(saved.nextType ?? 'A');
  const [isDark, setIsDark] = useState(saved.isDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [localBackup, setLocalBackup] = useState(saved.autoSave ?? false);
  const [preferredRest, setPreferredRest] = useState(saved.preferredRest ?? 90);
  const [soundEnabled, setSoundEnabled] = useState(saved.soundEnabled ?? false);
  const [vibrationEnabled, setVibrationEnabled] = useState(saved.vibrationEnabled ?? saved.hapticsEnabled ?? false);

  const [activeTab, setActiveTab] = useState('workout');
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [showPlateCalc, setShowPlateCalc] = useState(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [deloadAlert, setDeloadAlert] = useState(null);
  const [pendingDeloadWeights, setPendingDeloadWeights] = useState(null);
  const [expandedWarmups, setExpandedWarmups] = useState({});
  const [isExerciseComplete, setIsExerciseComplete] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const [pendingCSVImport, setPendingCSVImport] = useState(null);
  const [statsView, setStatsView] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [logGrouping, setLogGrouping] = useState(saved.logGrouping ?? 'all');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [completionSummary, setCompletionSummary] = useState(null);
  const [showResumePrompt, setShowResumePrompt] = useState(() => !!saved.activeSession);
  const [pendingDriveRestore, setPendingDriveRestore] = useState(null);
  const [showRestoreSourcePicker, setShowRestoreSourcePicker] = useState(false);
  const [connectSyncPrompt, setConnectSyncPrompt] = useState(null);

  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const audioCtxRef = useRef(null);
  const reverbRef = useRef(null);

  const gdrive = useGoogleDrive();

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
    weights, history, nextType: currentWorkoutType,
    isDark, autoSave: localBackup, preferredRest, soundEnabled, vibrationEnabled, logGrouping,
  });

  useStorageSync(STORAGE_KEY, (updated) => {
    if (updated.weights) setWeights(updated.weights);
    if (Array.isArray(updated.history)) setHistory(updated.history);
    if (updated.isDark !== undefined) setIsDark(updated.isDark);
  });

  useEffect(() => {
    if (!currentWorkout || !isWorkoutActive) return;
    const data = { session: currentWorkout, restTimerEndTime: timer.isActive ? (Date.now() + timer.seconds * 1000) : null };
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(data));
  }, [currentWorkout, isWorkoutActive, timer.isActive, timer.seconds]);

  useEffect(() => {
    if (!navExpanded || activeTab !== 'workout') return;
    const id = setTimeout(() => setNavExpanded(false), 30000);
    return () => clearTimeout(id);
  }, [navExpanded, activeTab]);

  const big3Total = useMemo(() => (weights?.squat || 0) + (weights?.bench || 0) + (weights?.deadlift || 0), [weights]);
  const plates = useMemo(() => calculatePlates(showPlateCalc?.weight), [showPlateCalc?.weight]);

  const best1RMs = useMemo(() => {
    const result = {};
    for (const id of EXPECTED_WEIGHT_KEYS) {
      result[id] = calculateBest1RM(history, id);
    }
    return result;
  }, [history]);

  const historyDateSet = useMemo(() => new Set(history.map(s => s.date.slice(0, 10))), [history]);
  const trainedToday = historyDateSet.has(new Date().toISOString().slice(0, 10));

  const getAppState = useCallback(() => ({
    weights, history, nextType: currentWorkoutType, isDark, autoSave: localBackup, preferredRest, soundEnabled, vibrationEnabled, logGrouping, language: i18n.language,
  }), [weights, history, currentWorkoutType, isDark, localBackup, preferredRest, soundEnabled, vibrationEnabled, logGrouping]);

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

  const handleToggleWarmup = useCallback((id) => setExpandedWarmups(prev => ({ ...prev, [id]: !prev[id] })), []);

  const handleUpdateActiveWeight = useCallback((exIdx, diff) => {
    setCurrentWorkout(prev => prev ? ({ ...prev, exercises: prev.exercises.map((e, i) => i !== exIdx ? e : ({ ...e, weight: Math.max(0, e.weight + diff) })) }) : null);
  }, []);

  const handleToggleSet = useCallback((exIdx, setIdx) => {
    if (timer.isExpired) timer.reset();
    setNavExpanded(false);
    setCurrentWorkout(prev => {
      if (!prev) return prev;
      const ex = prev.exercises[exIdx];
      const currVal = ex.setsCompleted[setIdx];
      let nextVal = currVal === null ? 5 : currVal > 0 ? currVal - 1 : null;
      const isLastSet = setIdx === ex.setsCompleted.length - 1;
      const nextWorkout = { ...prev, exercises: prev.exercises.map((e, i) => i !== exIdx ? e : ({ ...e, setsCompleted: e.setsCompleted.map((r, j) => j === setIdx ? nextVal : r) })) };

      if (nextVal !== null) {
        if (isLastSet) {
          timer.stop();
          const allDone = nextWorkout.exercises.every(e => e.setsCompleted.every(s => s !== null));
          setIsExerciseComplete(allDone ? 'workout' : true);
        } else {
          setIsExerciseComplete(false);
          const req = nextVal === 5 ? preferredRest : 300;
          timer.start(req);
        }
      } else { timer.stop(); setIsExerciseComplete(false); }
      return nextWorkout;
    });
  }, [timer, preferredRest]);

  const finishWorkout = useCallback(() => {
    const nextWeights = { ...weights };
    const progressions = [];
    const deloads = {};
    currentWorkout.exercises.forEach(ex => {
      const passed = ex.setsCompleted.every(r => r === 5);
      if (passed) {
        nextWeights[ex.id] = ex.weight + ex.increment;
        progressions.push(ex.id);
      } else {
        const priorFailures = getConsecutiveFailures(history, ex.id, ex.weight);
        if (priorFailures >= 2) {
          const newWeight = deloadWeight(ex.weight);
          nextWeights[ex.id] = newWeight;
          deloads[ex.id] = newWeight;
        }
      }
    });
    const savedWorkout = { ...currentWorkout, duration: Date.now() - (currentWorkout.startedAt || Date.now()) };
    delete savedWorkout.startedAt;
    const newHistory = [savedWorkout, ...history];
    setWeights(nextWeights); setHistory(newHistory);
    setCurrentWorkoutType(prev => prev === 'A' ? 'B' : 'A');
    setIsWorkoutActive(false); setCurrentWorkout(null);
    timer.reset(); setIsExerciseComplete(false);
    setCompletionSummary({ workout: savedWorkout, progressions, deloads });
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
    if (localBackup) exportData(newHistory);

    const nextType = currentWorkoutType === 'A' ? 'B' : 'A';
    saveToDriveQuietly({
      weights: nextWeights, history: newHistory, nextType,
      isDark, autoSave: localBackup, preferredRest, soundEnabled, vibrationEnabled, logGrouping,
    });
  }, [currentWorkout, history, weights, localBackup, exportData, timer, currentWorkoutType, isDark, preferredRest, soundEnabled, vibrationEnabled, logGrouping, saveToDriveQuietly]);

  const cancelWorkout = useCallback(() => {
    setIsWorkoutActive(false); setCurrentWorkout(null);
    timer.reset(); setIsExerciseComplete(false); setShowCancelModal(false);
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
  }, [timer]);

  const initializeWorkout = useCallback((workoutWeights) => {
    setCurrentWorkout({ date: new Date().toISOString(), type: currentWorkoutType, startedAt: Date.now(), exercises: WORKOUTS[currentWorkoutType].exercises.map(ex => ({ ...ex, weight: workoutWeights[ex.id], setsCompleted: new Array(ex.sets).fill(null) })) });
    setIsWorkoutActive(true); setActiveTab('workout'); setExpandedWarmups({}); setShowRestorePrompt(false); setIsExerciseComplete(false);
  }, [currentWorkoutType]);

  const startWorkout = useCallback((force = false) => {
    if (history.length === 0 && !force) { setShowRestorePrompt(true); return; }
    if (history.length > 0) {
      const last = new Date(history[0].date);
      const daysOff = Math.floor((new Date() - last) / 86400000);
      if (daysOff >= 14) {
        const newW = calculateDeload(weights);
        setPendingDeloadWeights(newW);
        setDeloadAlert([t('modals.deloadMessage', { days: daysOff })]);
        return;
      }
    }
    initializeWorkout(weights);
  }, [history, weights, initializeWorkout]);

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
        setWeights(d.weights); setHistory(d.history);
        if (d.nextType) setCurrentWorkoutType(d.nextType);
        setIsDark(d.isDark ?? true); setLocalBackup(d.autoSave ?? false);
        if (d.preferredRest) setPreferredRest(d.preferredRest);
        if (d.soundEnabled !== undefined) setSoundEnabled(d.soundEnabled);
        if (d.vibrationEnabled !== undefined) setVibrationEnabled(d.vibrationEnabled);
        if (d.logGrouping) setLogGrouping(d.logGrouping);
        if (d.language) i18n.changeLanguage(d.language);
        setActiveTab('workout'); setShowRestorePrompt(false); setShowRestoreSourcePicker(false);
        showToast(t('toast.backupRestored'), 'success');
        saveToDriveQuietly({
          weights: d.weights, history: d.history, nextType: d.nextType || currentWorkoutType,
          isDark: d.isDark ?? true, autoSave: d.autoSave ?? false,
          preferredRest: d.preferredRest || preferredRest,
          soundEnabled: d.soundEnabled ?? soundEnabled,
          vibrationEnabled: d.vibrationEnabled ?? vibrationEnabled,
          logGrouping: d.logGrouping || logGrouping,
          language: d.language || i18n.language,
        });
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
    setWeights(d.weights); setHistory(d.history);
    if (d.nextType) setCurrentWorkoutType(d.nextType);
    setIsDark(d.isDark ?? true); setLocalBackup(d.autoSave ?? false);
    if (d.preferredRest) setPreferredRest(d.preferredRest);
    if (d.soundEnabled !== undefined) setSoundEnabled(d.soundEnabled);
    if (d.vibrationEnabled !== undefined) setVibrationEnabled(d.vibrationEnabled);
    if (d.logGrouping) setLogGrouping(d.logGrouping);
    if (d.language) i18n.changeLanguage(d.language);
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
    setShowRestoreSourcePicker(false);
    if (result.stale) {
      setPendingDriveRestore({ data: result.data, cloudDate: result.cloudDate, localDate: result.localDate });
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

    if (backup.modifiedTime > latestLocal) {
      setConnectSyncPrompt({
        type: 'driveNewer',
        cloudDate: backup.modifiedTime.toLocaleDateString(),
        localDate: latestLocal.toLocaleDateString(),
      });
    } else if (latestLocal > backup.modifiedTime) {
      setConnectSyncPrompt({
        type: 'localNewer',
        cloudDate: backup.modifiedTime.toLocaleDateString(),
        localDate: latestLocal.toLocaleDateString(),
      });
    }
  }, [gdrive, history, getAppState, applyDriveRestore, showToast, t]);

  const handleManualLogSave = useCallback((newHistory) => {
    const nextState = { ...getAppState(), history: newHistory };
    saveToDriveQuietly(nextState);
  }, [getAppState, saveToDriveQuietly]);

  const formatLastSaved = useCallback((date) => {
    if (!date) return null;
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Today, ${time}` : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
  }, []);

  const getTopOffset = () => 0;

  const timerVisible = activeTab === 'workout' && (timer.isActive || timer.isExpired || isExerciseComplete);
  const navCollapsed = isWorkoutActive && activeTab === 'workout' && !navExpanded;
  const liveWorkoutVisible = isWorkoutActive && currentWorkout && activeTab !== 'workout';

  const handleTabClick = useCallback((tabId) => {
    setActiveTab(tabId);
    if (tabId === 'workout') setNavExpanded(false);
  }, []);

  const handleTimerSkip = useCallback(() => {
    if (audioCtxRef.current?.state === 'suspended') { audioCtxRef.current.resume(); }
    if (isExerciseComplete) {
      timer.reset();
      setIsExerciseComplete(false);
    } else {
      timer.skip();
    }
    setNavExpanded(false);
  }, [timer, isExerciseComplete]);

  const driveConfigured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <div className={`min-h-screen flex flex-col font-sans max-w-md mx-auto relative transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {activeTab === 'workout' && (
        <RestTimer
          seconds={timer.seconds} total={preferredRest}
          isDark={isDark} isExerciseComplete={isExerciseComplete} isExpired={timer.isExpired}
          onSkip={handleTimerSkip} navExpanded={navExpanded} elapsed={timer.elapsed}
        />
      )}

      {isWorkoutActive && currentWorkout && activeTab !== 'workout' && (() => {
        const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
        const liveDetail = timer.isExpired
          ? t('liveWorkout.lifting', { time: formatTime(timer.elapsed) })
          : timer.isActive
            ? t('liveWorkout.resting', { time: formatTime(timer.seconds) })
            : t(`workout.type${currentWorkout?.type}`) || t('liveWorkout.activeWorkout');
        const liveIcon = timer.isExpired
          ? <Dumbbell size={14} className="text-white" />
          : timer.isActive
            ? <Timer size={14} className="text-white" />
            : <Play size={14} fill="currentColor" className="text-white" />;
        return (
          <div className={`fixed bottom-[80px] inset-x-0 max-w-md mx-auto z-[100] shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.3)] transition-all duration-300 ${isDark ? 'bg-indigo-900' : 'bg-indigo-600'}`}>
            <button onClick={() => handleTabClick('workout')} className="w-full px-6 py-4 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-white/20">{liveIcon}</div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase text-white/60 leading-none mb-0.5">{t('liveWorkout.title')}</p>
                  <p className={`text-xs font-black uppercase text-white tracking-tight ${timer.isActive || timer.isExpired ? 'font-mono' : ''}`}>{liveDetail}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black uppercase text-white/90 bg-black/10 px-3 py-1.5 rounded-lg">{t('liveWorkout.return')} <ChevronRight size={12} /></div>
            </button>
          </div>
        );
      })()}

      <header className={`px-6 pt-10 pb-4 flex justify-between items-center transition-all duration-300 ${isDark ? 'bg-slate-950/80' : 'bg-slate-50/80'} backdrop-blur-md sticky z-40`} style={{ top: getTopOffset() }}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-600 shadow-lg"><Dumbbell className="text-white" size={20} /></div>
          <h1 className={`text-xl font-black tracking-tight uppercase ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('app.title')}</h1>
        </div>
        <button onClick={() => setShowHelp(true)} aria-label="How it works" className={`p-2.5 rounded-2xl border transition-all ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-500'}`}><HelpCircle size={20} /></button>
      </header>

      <main className={`flex-1 px-4 py-4 overflow-y-auto ${timerVisible ? 'pb-44' : liveWorkoutVisible ? 'pb-52' : navCollapsed ? 'pb-24' : 'pb-32'}`}>
        {activeTab === 'workout' && (
          <div className="space-y-4">
            {!isWorkoutActive ? (
              <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="mb-6"><p className="text-[10px] font-bold uppercase text-slate-500 mb-1 tracking-widest">{t('workout.nextUp')}</p><button onClick={() => setCurrentWorkoutType(v => v === 'A' ? 'B' : 'A')} className="flex items-start gap-2 hover:opacity-70 transition-opacity"><h2 className="text-4xl font-black uppercase leading-tight">{t(`workout.type${currentWorkoutType}`)}</h2><RefreshCw size={20} className="mt-3 text-indigo-500" /></button></div>
                <div className="space-y-3 mb-8">{WORKOUTS[currentWorkoutType].exercises.map(ex => (
                  <div key={ex.id} className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-transparent'}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex-1 pr-4"><p className={`font-black text-sm uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{t('exercises.' + ex.id)}</p><p className="text-[10px] font-bold text-slate-500">{ex.sets}x{ex.reps}</p></div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setWeights({ ...weights, [ex.id]: Math.max(0, weights[ex.id] - ex.increment) })} aria-label={`Decrease ${t('exercises.' + ex.id)} weight`} className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Minus size={14} /></button>
                        <span className="font-black w-12 text-center text-xl">{weights[ex.id]}</span>
                        <button onClick={() => setWeights({ ...weights, [ex.id]: weights[ex.id] + ex.increment })} aria-label={`Increase ${t('exercises.' + ex.id)} weight`} className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Plus size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}</div>
                <button onClick={() => startWorkout()} disabled={trainedToday} className={`w-full py-5 rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl transition-transform ${trainedToday ? 'bg-slate-800 text-slate-600 opacity-40 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98]'}`}><Play size={20} fill="currentColor" /> {t('workout.startWorkout')}</button>
                {trainedToday && <p className="text-slate-500 text-[10px] font-black uppercase text-center mt-3 tracking-widest">{t('workout.alreadyTrained')}</p>}
                {!trainedToday && history.length === 0 && <p className="text-slate-500 text-[10px] font-bold text-center mt-3">{t('workout.autoIncreaseHint')}</p>}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center mb-2"><h2 className="font-black uppercase tracking-widest text-slate-500">{currentWorkout ? t(`workout.type${currentWorkout.type}`) : ''}</h2></div>
                {currentWorkout?.exercises.map((ex, exIdx) => (
                  <ExerciseCard key={ex.id} ex={ex} exIdx={exIdx} isDark={isDark} onToggleSet={handleToggleSet} onShowPlates={setShowPlateCalc} expanded={expandedWarmups[ex.id]} onToggleWarmup={handleToggleWarmup} onUpdateWeight={handleUpdateActiveWeight} />
                ))}
                <div className="pt-4 flex flex-col items-center">
                  <button onClick={finishWorkout} disabled={!currentWorkout?.exercises.every(ex => ex.setsCompleted.every(s => s !== null))} className={`w-full py-5 rounded-[1.5rem] font-black text-lg shadow-xl ${currentWorkout?.exercises.every(ex => ex.setsCompleted.every(s => s !== null)) ? 'bg-emerald-600 text-white active:scale-95 shadow-emerald-900/20' : 'bg-slate-800 text-slate-600 opacity-40 cursor-not-allowed'}`}>{t('workout.finishWorkout')}</button>
                  {!currentWorkout?.exercises.every(ex => ex.setsCompleted.every(s => s !== null)) && <p className="text-slate-500 text-[10px] font-black uppercase text-center mt-3 tracking-widest animate-pulse">{t('workout.completeAllSets')}</p>}
                  <button onClick={() => setShowCancelModal(true)} className={`mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-600 border-slate-900' : 'text-slate-400 border-slate-100'} px-6 py-3 border rounded-xl active:text-rose-500 transition-colors`}><Trash2 size={12} /> {t('workout.discardWorkout')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-3xl font-black uppercase tracking-tighter">{t('log.title')}</h2>
              <button
                onClick={() => {
                  const type = currentWorkoutType;
                  const workout = {
                    date: new Date().toISOString(),
                    type,
                    exercises: WORKOUTS[type].exercises.map(ex => ({ ...ex, weight: weights[ex.id], setsCompleted: new Array(ex.sets).fill(5) })),
                  };
                  setEditingEntry({ index: -1, session: workout });
                }}
                aria-label="Add workout"
                className={`p-2.5 rounded-xl border active:scale-90 transition-transform ${isDark ? 'bg-slate-900 border-slate-800 text-indigo-400' : 'bg-white border-slate-200 text-indigo-600 shadow-sm'}`}
              ><Plus size={20} /></button>
            </div>
            {(() => {
              const stats = getWorkoutStats(history);
              const flameColor = stats.streak > 0 ? 'text-amber-500' : 'text-slate-400';
              return (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < stats.thisWeek ? 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.4)]' : (isDark ? 'bg-slate-700' : 'bg-slate-300')}`} />
                    ))}
                  </div>
                  <span className={`text-xs font-black uppercase ${stats.status.color === 'emerald' ? 'text-emerald-500' : stats.status.color === 'amber' ? 'text-amber-500' : 'text-rose-500'}`}>{t(`status.${stats.status.key}`, { count: stats.status.count })}</span>
                  <span className="text-slate-500">·</span>
                  <span className="flex items-center gap-1">
                    <Flame size={12} className={flameColor} />
                    <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('log.weekUnit', { count: stats.streak })}</span>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{stats.total} {t('log.total')}</span>
                </div>
              );
            })()}

            {history.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {[{ label: t('log.all'), val: 'all' }, { label: t('log.week'), val: 'week' }, { label: t('log.month'), val: 'month' }, { label: t('log.year'), val: 'year' }].map(opt => (
                  <button key={opt.val} onClick={() => { setLogGrouping(opt.val); if (opt.val !== 'all') { const groups = groupHistory(history, opt.val, 0); setExpandedGroups(groups.length > 0 ? { [groups[0].key]: true } : {}); } else { setExpandedGroups({}); } }} className={`py-2 rounded-xl font-black text-[10px] uppercase tracking-wide transition-all ${logGrouping === opt.val ? 'bg-indigo-600 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-500 border border-slate-800' : 'bg-white text-slate-400 border border-slate-200')}`}>{opt.label}</button>
                ))}
              </div>
            )}

            {history.length === 0 ? (
              <p className="py-20 text-center text-slate-500 font-bold">{t('log.noHistory')}</p>
            ) : logGrouping === 'all' ? (
              history.map((s, i) => (
                <button key={i} onClick={() => setEditingEntry({ index: i, session: JSON.parse(JSON.stringify(s)) })} className={`w-full text-left p-6 rounded-3xl border active:scale-[0.98] transition-transform ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <div className="flex justify-between items-center mb-4"><span className={`text-xs font-black uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{t(`workout.type${s.type}`)}</span><span className="text-xs font-bold text-slate-500">{s.duration ? `${formatDuration(s.duration, t)} · ` : ''}{new Date(s.date).toLocaleDateString()}</span></div>
                  <div className="space-y-2">{s.exercises.map(ex => (<div key={ex.id} className="flex justify-between text-sm items-center"><span className="font-bold text-slate-400 uppercase text-[10px]">{t('exercises.' + ex.id)}</span><div className="flex items-center gap-3"><span className="font-black">{ex.weight}kg</span><div className="flex gap-0.5">{ex.setsCompleted.map((r, ri) => (<div key={ri} className={`w-1.5 h-1.5 rounded-full ${r === 5 ? 'bg-indigo-500' : 'bg-rose-500'}`} />))}</div></div></div>))}</div>
                </button>
              ))
            ) : (
              groupHistory(history, logGrouping, 0).map((group, gi) => (
                <div key={group.key}>
                  <button
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                    aria-label={`Toggle ${group.key}`}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all active:scale-[0.99] ${isDark ? 'bg-slate-900/60 border-slate-800 hover:bg-slate-900' : 'bg-white/60 border-slate-100 hover:bg-white'}`}
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown size={16} className={`transition-transform duration-200 ${isDark ? 'text-slate-500' : 'text-slate-400'} ${expandedGroups[group.key] ? 'rotate-0' : '-rotate-90'}`} />
                      <span className={`text-sm font-black uppercase tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{group.key}</span>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{group.entries.length}</span>
                  </button>
                  {expandedGroups[group.key] && (
                    <div className="space-y-3 mt-3 ml-2">
                      {group.entries.map(({ session: s, originalIndex }) => (
                        <button key={originalIndex} onClick={() => setEditingEntry({ index: originalIndex, session: JSON.parse(JSON.stringify(s)) })} className={`w-full text-left p-6 rounded-3xl border active:scale-[0.98] transition-transform ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                          <div className="flex justify-between items-center mb-4"><span className={`text-xs font-black uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{t(`workout.type${s.type}`)}</span><span className="text-xs font-bold text-slate-500">{s.duration ? `${formatDuration(s.duration, t)} · ` : ''}{new Date(s.date).toLocaleDateString()}</span></div>
                          <div className="space-y-2">{s.exercises.map(ex => (<div key={ex.id} className="flex justify-between text-sm items-center"><span className="font-bold text-slate-400 uppercase text-[10px]">{t('exercises.' + ex.id)}</span><div className="flex items-center gap-3"><span className="font-black">{ex.weight}kg</span><div className="flex gap-0.5">{ex.setsCompleted.map((r, ri) => (<div key={ri} className={`w-1.5 h-1.5 rounded-full ${r === 5 ? 'bg-indigo-500' : 'bg-rose-500'}`} />))}</div></div></div>))}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="space-y-6">
            {history.length === 0 ? (
              <div className="py-20 text-center px-10">
                <div className="flex justify-center mb-6"><div className={`p-5 rounded-3xl ${isDark ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}><TrendingUp size={48} /></div></div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">{t('stats.noStats')}</h2>
                <p className="text-slate-500 text-sm font-bold leading-relaxed">{t('stats.noStatsBody')}</p>
              </div>
            ) : statsView ? (
              <StatsChart exerciseId={statsView} history={history} isDark={isDark} onBack={() => setStatsView(null)} weights={weights} best1RMs={best1RMs} />
            ) : (
              <>
                {(() => {
                  const big3Trend = getBig3Trend(history);
                  const TrendIcon = big3Trend === 'up' ? TrendingUp : big3Trend === 'down' ? TrendingDown : MoveRight;
                  const trendColor = big3Trend === 'up' ? 'text-emerald-500' : big3Trend === 'down' ? 'text-rose-500' : 'text-amber-500';
                  return (
                    <button onClick={() => setStatsView('big3')} className={`w-full p-6 rounded-[2rem] border flex justify-between items-center active:scale-[0.98] transition-transform ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className="text-left"><h2 className="text-3xl font-black uppercase tracking-tighter">{t('stats.title')}</h2></div>
                      <div className="flex items-center gap-2">
                        {big3Trend && <TrendIcon size={16} className={trendColor} />}
                        <div className="text-right"><p className="text-[10px] font-bold text-slate-500 uppercase">{t('stats.big3Total')}</p><p className={`text-2xl font-black ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{big3Total}kg</p></div>
                        <ChevronRight size={16} className="text-slate-500 ml-1" />
                      </div>
                    </button>
                  );
                })()}
                <div className="grid gap-3">{EXPECTED_WEIGHT_KEYS.map(id => {
                  const trend = getExerciseTrend(history, id);
                  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : MoveRight;
                  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-amber-500';
                  return (
                    <button key={id} onClick={() => setStatsView(id)} className={`w-full p-6 rounded-[2rem] border flex justify-between items-center active:scale-[0.98] transition-transform ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                      <div className="flex items-center gap-4 flex-1 min-w-0"><div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Zap size={20} /></div><div className="min-w-0 pr-2"><p className={`text-sm font-black uppercase truncate ${isDark ? 'text-indigo-100' : 'text-slate-900'}`}>{t('exercises.' + id)}</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-none">{t('stats.est1rmValue', { value: best1RMs[id] || weights[id] })}</p></div></div>
                      <div className="flex items-center gap-2">
                        {trend && <TrendIcon size={16} className={trendColor} />}
                        <span className={`shrink-0 font-black text-xl ${isDark ? 'text-indigo-500' : 'text-indigo-600'}`}>{weights[id]}kg</span>
                        <ChevronRight size={16} className="text-slate-500" />
                      </div>
                    </button>
                  );
                })}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black mb-6 uppercase tracking-tighter">{t('options.title')}</h2>
            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Clock size={20} /></div>
                <div><p className="text-sm font-black uppercase tracking-tight">{t('options.restInterval')}</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{t('options.restIntervalDesc')}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[{ label: '1:30', val: 90 }, { label: '3:00', val: 180 }, { label: '5:00', val: 300 }].map(opt => (
                  <button key={opt.val} onClick={() => setPreferredRest(opt.val)} className={`py-3 rounded-xl font-black text-xs transition-all ${preferredRest === opt.val ? 'bg-indigo-600 text-white shadow-lg' : (isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}`}>{opt.label}</button>
                ))}
              </div>
            </div>

            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Bell size={20} /></div>
                  <div><p className="text-sm font-black uppercase">{t('options.soundAlert')}</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{t('options.soundAlertDesc')}</p></div>
                </div>
                <button onClick={() => setSoundEnabled(!soundEnabled)} role="switch" aria-checked={soundEnabled} aria-label="Sound alert">{soundEnabled ? <ToggleRight size={48} className="text-indigo-500" /> : <ToggleLeft size={48} className={isDark ? 'text-slate-800' : 'text-slate-200'} />}</button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Vibrate size={20} /></div>
                  <div><p className="text-sm font-black uppercase">{t('options.vibration')}</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{t('options.vibrationDesc')}</p></div>
                </div>
                <button onClick={() => setVibrationEnabled(!vibrationEnabled)} role="switch" aria-checked={vibrationEnabled} aria-label="Vibration">{vibrationEnabled ? <ToggleRight size={48} className="text-indigo-500" /> : <ToggleLeft size={48} className={isDark ? 'text-slate-800' : 'text-slate-200'} />}</button>
              </div>
            </div>

            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Moon size={20} /></div>
                  <div><p className="text-sm font-black uppercase">{t('options.darkMode')}</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{t('options.darkModeDesc')}</p></div>
                </div>
                <button onClick={() => setIsDark(!isDark)} role="switch" aria-checked={isDark} aria-label="Dark mode">{isDark ? <ToggleRight size={48} className="text-indigo-500" /> : <ToggleLeft size={48} className={isDark ? 'text-slate-800' : 'text-slate-200'} />}</button>
              </div>
            </div>

            {/* Backup & Sync */}
            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center gap-4 mb-5">
                <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><FolderSync size={20} /></div>
                <div><p className="text-sm font-black uppercase">{t('options.backupSync')}</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{t('options.backupSyncDesc')}</p></div>
              </div>

              {/* Local Backup toggle */}
              <div className={`flex items-center justify-between p-4 rounded-2xl mb-4 ${isDark ? 'bg-slate-950/50 border border-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <HardDrive size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                  <div><p className="text-xs font-black uppercase">{t('options.localBackup')}</p><p className="text-[10px] font-bold text-slate-500 leading-tight">{t('options.localBackupDesc')}</p></div>
                </div>
                <button onClick={() => setLocalBackup(!localBackup)} role="switch" aria-checked={localBackup} aria-label="Local backup">{localBackup ? <ToggleRight size={36} className="text-indigo-500" /> : <ToggleLeft size={36} className={isDark ? 'text-slate-700' : 'text-slate-300'} />}</button>
              </div>

              {/* Google Drive section */}
              {driveConfigured && (
                <div className={`p-4 rounded-2xl mb-4 ${isDark ? 'bg-slate-950/50 border border-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Cloud size={16} className={gdrive.isConnected ? 'text-emerald-500' : gdrive.hasEverConnected ? 'text-amber-500' : (isDark ? 'text-slate-400' : 'text-slate-500')} />
                      <div><p className="text-xs font-black uppercase">{t('options.googleDrive')}</p><p className="text-[10px] font-bold text-slate-500 leading-tight">{t('options.googleDriveDesc')}</p></div>
                    </div>
                    {gdrive.isConnected ? (
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${isDark ? 'bg-emerald-950/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{t('options.connectedToDrive')}</span>
                    ) : (
                      <button onClick={handleConnect} className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all active:scale-95 ${isDark ? 'bg-blue-950/30 text-blue-400 border border-blue-900/40' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>{gdrive.hasEverConnected ? t('options.reconnectDrive') : t('options.connectDrive')}</button>
                    )}
                  </div>
                  {(gdrive.isConnected || gdrive.hasEverConnected) && (
                    <div className="mt-3 space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 leading-tight">{t('options.savesAfterWorkout')}</p>
                      {gdrive.saveFailed ? (
                        <button onClick={handleDriveSave} className="text-[10px] font-bold text-rose-500 active:scale-95">{t('options.saveFailed')}</button>
                      ) : gdrive.lastSavedAt ? (
                        <p className="text-[10px] font-bold text-emerald-500">{t('options.lastSaved', { time: formatLastSaved(gdrive.lastSavedAt) })}</p>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* Backup & Restore buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => exportData()} className={`p-4 rounded-2xl flex flex-col items-center gap-2 font-black uppercase text-[10px] active:scale-95 transition-transform bg-indigo-600 text-white shadow-lg`}>
                  <Download size={20} /> {t('options.backupToDevice')}
                </button>
                <button onClick={() => {
                  if (driveConfigured && gdrive.isConnected) {
                    setShowRestoreSourcePicker(true);
                  } else {
                    fileInputRef.current?.click();
                  }
                }} className={`p-4 rounded-2xl flex flex-col items-center gap-2 font-black uppercase text-[10px] active:scale-95 transition-transform border ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200'}`}>
                  <Upload size={20} /> {t('options.restore')}
                </button>
              </div>
            </div>

            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Globe size={20} /></div>
                  <div><p className="text-sm font-black uppercase">{t('options.language')}</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{t('options.languageDesc')}</p></div>
                </div>
                <div className="flex gap-1.5">
                  {[{ code: 'en', label: 'EN' }, { code: 'fr', label: 'FR' }].map(lang => (
                    <button key={lang.code} onClick={() => i18n.changeLanguage(lang.code)} className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase transition-all ${i18n.language?.startsWith(lang.code) ? 'bg-indigo-600 text-white shadow-lg' : (isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}`}>{lang.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => csvInputRef.current?.click()} className={`w-full p-5 rounded-[2rem] flex items-center gap-4 border active:scale-[0.98] transition-transform ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><FileSpreadsheet size={20} /></div>
              <div className="text-left"><p className="text-sm font-black uppercase">{t('options.importStronglifts')}</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{t('options.importStrongliftsDesc')}</p></div>
            </button>
          </div>
        )}
      </main>

      {isWorkoutActive && activeTab === 'workout' && !navExpanded ? (
        <nav className={`fixed bottom-0 left-0 right-0 border-t px-6 py-3 flex justify-center items-center max-w-md mx-auto z-20 backdrop-blur-lg ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]'}`}>
          <button onClick={() => setNavExpanded(true)} aria-label="Show navigation" className={`p-2 rounded-xl transition-all active:scale-110 ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}>
            <Menu size={24} />
          </button>
        </nav>
      ) : (
        <nav className={`fixed bottom-0 left-0 right-0 border-t px-6 py-6 flex justify-between items-center max-w-md mx-auto z-20 backdrop-blur-lg ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]'}`}>
          {[{ id: 'workout', label: t('tabs.train'), icon: Dumbbell }, { id: 'history', label: t('tabs.log'), icon: History }, { id: 'progress', label: t('tabs.stats'), icon: TrendingUp }, { id: 'settings', label: t('tabs.options'), icon: SettingsIcon }].map(tab => (
            <button key={tab.id} onClick={() => handleTabClick(tab.id)} aria-label={tab.label} className={`flex flex-col items-center gap-1.5 transition-all active:scale-125 ${activeTab === tab.id ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (isDark ? 'text-slate-700' : 'text-slate-300')}`}><tab.icon size={24} strokeWidth={activeTab === tab.id ? 3 : 2} /><span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span></button>
          ))}
        </nav>
      )}

      {showCancelModal && (
        <div role="dialog" aria-modal="true" aria-label="Discard workout" className={`fixed inset-0 z-[500] flex items-center justify-center p-8 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/95' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-xs flex flex-col items-center p-8 rounded-[2.5rem] border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="p-5 rounded-full bg-rose-500/10 text-rose-500 mb-6"><Trash2 size={48} /></div>
            <h3 className={`text-2xl font-black uppercase mb-4 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('modals.discardTitle')}</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-10">{t('modals.discardBody')}</p>
            <button onClick={() => setShowCancelModal(false)} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-900/40 mb-6 active:scale-95">{t('modals.keepLifting')}</button>
            <button onClick={cancelWorkout} className="text-rose-500 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 active:scale-90">{t('modals.yesDiscard')}</button>
          </div>
        </div>
      )}

      {deloadAlert && (
        <div role="dialog" aria-modal="true" aria-label="Deload recommendation" className={`fixed inset-0 z-[400] flex items-center justify-center p-6 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/90' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500 animate-bounce"><TrendingDown size={48} /></div></div>
            <h3 className={`text-2xl font-black mb-4 uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('modals.acceptDeload')}</h3>
            <div className="space-y-3 mb-8">{deloadAlert.map((r, i) => <p key={i} className="text-slate-400 text-xs font-bold leading-relaxed">{r}</p>)}</div>
            <button onClick={() => { setWeights(pendingDeloadWeights); initializeWorkout(pendingDeloadWeights); setPendingDeloadWeights(null); setDeloadAlert(null); }} className="w-full py-5 bg-amber-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl active:scale-95 mb-4">{t('modals.acceptAndLift')}</button>
            <button onClick={() => { initializeWorkout(weights); setPendingDeloadWeights(null); setDeloadAlert(null); }} className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 active:scale-90">{t('modals.skipDeload')}</button>
          </div>
        </div>
      )}

      {showRestorePrompt && (
        <div role="dialog" aria-modal="true" aria-label="Restore backup" className={`fixed inset-0 z-[300] flex items-center justify-center p-6 text-center backdrop-blur-md ${isDark ? 'bg-slate-950/90' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className="p-4 rounded-3xl bg-indigo-500/10 text-indigo-500 animate-pulse"><AlertCircle size={48} /></div></div>
            <h3 className={`text-2xl font-black mb-2 uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('modals.syncHistory')}</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-10">{t('modals.syncHistoryBody')}</p>
            <div className="space-y-4">
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95"><Upload size={20} className="inline mr-2" /> {t('modals.restoreBackup')}</button>
              {driveConfigured && (
                <button onClick={handleConnect} className={`w-full py-5 rounded-2xl font-black uppercase text-sm active:scale-95 border ${isDark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'}`}><Cloud size={20} className="inline mr-2" /> {t('modals.restoreFromDrive')}</button>
              )}
              <button onClick={() => csvInputRef.current?.click()} className={`w-full py-5 rounded-2xl font-black uppercase text-sm active:scale-95 border ${isDark ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}><FileSpreadsheet size={20} className="inline mr-2" /> {t('options.importStronglifts')}</button>
              <button onClick={() => startWorkout(true)} className="text-[10px] font-black uppercase text-slate-700 tracking-[0.3em] mt-8 block mx-auto">{t('modals.skipAndStart')}</button>
            </div>
          </div>
        </div>
      )}

      {showResumePrompt && saved.activeSession && (
        <div role="dialog" aria-modal="true" aria-label="Resume workout" className={`fixed inset-0 z-[350] flex items-center justify-center p-6 text-center backdrop-blur-md ${isDark ? 'bg-slate-950/90' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className={`p-4 rounded-3xl ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Dumbbell size={48} /></div></div>
            <h3 className={`text-2xl font-black mb-2 uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('modals.resumeWorkout')}</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-2">{t('modals.inProgress', { name: t(`workout.type${saved.activeSession.session.type}`) })}</p>
            <p className="text-slate-500 text-xs font-bold mb-8">
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
              className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95 mb-4"
            >{t('modals.resume')}</button>
            <button
              onClick={() => {
                localStorage.removeItem(ACTIVE_WORKOUT_KEY);
                setShowResumePrompt(false);
              }}
              className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 active:scale-90"
            >{t('modals.discard')}</button>
          </div>
        </div>
      )}

      {showPlateCalc && (
        <div role="dialog" aria-modal="true" aria-label="Plate calculator" className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm ${isDark ? 'bg-slate-950/80' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <button onClick={() => setShowPlateCalc(null)} aria-label="Close plate calculator" className={`absolute top-4 right-4 p-2 rounded-full ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}><X size={20} /></button>
            <div className="text-center mb-8"><h3 className={`text-3xl font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>{showPlateCalc.weight} KG</h3><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">{t('modals.platesPerSide')}</p></div>
            <div className="flex flex-wrap justify-center gap-3 mb-8">{plates.map((p, i) => (<div key={i} className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center font-black ${p >= 20 ? 'bg-indigo-600 border-indigo-500 text-white' : p >= 10 ? 'bg-slate-800 border-slate-700 text-white' : (isDark ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400')}`}><span className="text-[10px] opacity-50 leading-none">KG</span><span>{p}</span></div>))}</div>
            <button onClick={() => setShowPlateCalc(null)} className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'}`}>{t('modals.close')}</button>
          </div>
        </div>
      )}

      {pendingCSVImport && (
        <div role="dialog" aria-modal="true" aria-label="Confirm StrongLifts import" className={`fixed inset-0 z-[300] flex items-center justify-center p-6 text-center backdrop-blur-md ${isDark ? 'bg-slate-950/90' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className={`p-4 rounded-3xl ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><FileSpreadsheet size={48} /></div></div>
            <h3 className={`text-2xl font-black mb-2 uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('modals.importData')}</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-6">{t('modals.foundWorkouts', { count: pendingCSVImport.history.length })}</p>
            <div className="grid grid-cols-2 gap-2 mb-8">
              {EXPECTED_WEIGHT_KEYS.map(id => (
                <div key={id} className={`p-3 rounded-xl text-left ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-1">{t('exercises.' + id)}</p>
                  <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{pendingCSVImport.weights[id]}kg</p>
                </div>
              ))}
            </div>
            <button onClick={applyCSVImport} className="w-full py-5 bg-amber-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95 mb-4">{t('modals.import')}</button>
            <button onClick={() => setPendingCSVImport(null)} className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 active:scale-90">{t('modals.cancel')}</button>
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
        <div role="dialog" aria-modal="true" aria-label={isNewEntry ? 'Add workout' : 'Edit workout'} className={`fixed inset-0 z-[250] flex items-start justify-center overflow-y-auto backdrop-blur-md ${isDark ? 'bg-slate-950/90' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-md mx-auto my-6 rounded-[2.5rem] p-6 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{isNewEntry ? t('modals.addWorkout') : t('modals.editWorkout')}</h3>
              <button onClick={() => { setEditingEntry(null); setShowDeleteConfirm(false); }} aria-label="Close edit modal" className={`p-2 rounded-full ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}><X size={20} /></button>
            </div>

            {isNewEntry && (
              <div className="mb-6">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">{t('modals.workoutType')}</label>
                <div className="flex gap-2">
                  {['A', 'B'].map(wt => (
                    <button
                      key={wt}
                      onClick={() => setEditingEntry(prev => ({
                        ...prev,
                        session: {
                          ...prev.session,
                          type: wt,
                          exercises: WORKOUTS[wt].exercises.map(ex => ({ ...ex, weight: weights[ex.id], setsCompleted: new Array(ex.sets).fill(5) })),
                        },
                      }))}
                      className={`flex-1 py-3 rounded-xl font-black uppercase text-sm transition-all ${editingEntry.session.type === wt ? 'bg-indigo-600 text-white shadow-lg' : (isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200')}`}
                    >{t(`workout.type${wt}`)}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">{t('modals.date')}</label>
              <input
                type="date"
                value={editingEntry.session.date.slice(0, 10)}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  newDate.setHours(12, 0, 0, 0);
                  setEditingEntry(prev => ({ ...prev, session: { ...prev.session, date: newDate.toISOString() } }));
                }}
                className={`w-full p-3 rounded-xl font-bold text-sm border ${dateConflict || isFutureDate ? 'border-rose-500' : (isDark ? 'border-slate-700' : 'border-slate-200')} ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}
              />
              {dateConflict && <p className="text-rose-500 text-xs font-bold mt-2">{t('modals.dateConflict')}</p>}
              {isFutureDate && <p className="text-rose-500 text-xs font-bold mt-2">{t('modals.futureDate')}</p>}
            </div>

            <div className="space-y-4 mb-8">
              {editingEntry.session.exercises.map((ex, exIdx) => (
                <div key={ex.id} className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                  <p className={`font-black text-xs uppercase mb-3 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{t('exercises.' + ex.id)}</p>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t('modals.weightLabel')}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingEntry(prev => {
                          const s = JSON.parse(JSON.stringify(prev.session));
                          s.exercises[exIdx].weight = Math.max(0, s.exercises[exIdx].weight - 2.5);
                          return { ...prev, session: s };
                        })}
                        aria-label={`Decrease ${ex.name} weight`}
                        className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:scale-90`}
                      ><Minus size={14} /></button>
                      <span className="font-black w-14 text-center text-lg">{ex.weight}kg</span>
                      <button
                        onClick={() => setEditingEntry(prev => {
                          const s = JSON.parse(JSON.stringify(prev.session));
                          s.exercises[exIdx].weight += 2.5;
                          return { ...prev, session: s };
                        })}
                        aria-label={`Increase ${ex.name} weight`}
                        className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:scale-90`}
                      ><Plus size={14} /></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t('modals.setsLabel')}</span>
                    <div className="flex gap-2">
                      {ex.setsCompleted.map((reps, setIdx) => {
                        const bgColor = reps === null ? (isDark ? 'bg-slate-700' : 'bg-slate-300')
                          : reps === 5 ? 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.4)]'
                          : reps === 0 ? 'bg-rose-500'
                          : 'bg-amber-500';
                        return (
                          <button
                            key={setIdx}
                            onClick={() => setEditingEntry(prev => {
                              const s = JSON.parse(JSON.stringify(prev.session));
                              const cur = s.exercises[exIdx].setsCompleted[setIdx];
                              s.exercises[exIdx].setsCompleted[setIdx] = cur === null ? 5 : cur === 0 ? null : cur - 1;
                              return { ...prev, session: s };
                            })}
                            aria-label={`Set ${setIdx + 1}: ${reps === null ? 'not done' : reps + ' reps'}`}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white active:scale-90 transition-transform ${bgColor}`}
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
                const newHistory = isNewEntry
                  ? [...history, editingEntry.session].sort((a, b) => new Date(b.date) - new Date(a.date))
                  : history.map((s, i) => i === editingEntry.index ? editingEntry.session : s);
                setHistory(newHistory);
                showToast(t(isNewEntry ? 'toast.workoutAdded' : 'toast.workoutUpdated'), 'success');
                setEditingEntry(null);
                handleManualLogSave(newHistory);
              }}
              className={`w-full py-4 rounded-2xl font-black uppercase text-sm shadow-xl mb-4 ${dateConflict || isFutureDate ? 'bg-slate-800 text-slate-600 opacity-40 cursor-not-allowed' : 'bg-indigo-600 text-white active:scale-95'}`}
            >{isNewEntry ? t('modals.addWorkout') : t('modals.saveChanges')}</button>

            {!isNewEntry && (
              !showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-500 tracking-widest py-3 active:scale-90"
                ><Trash2 size={12} /> {t('modals.deleteWorkout')}</button>
              ) : (
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-rose-950/20 border-rose-900/30' : 'bg-rose-50 border-rose-200'}`}>
                  <p className={`text-xs font-bold text-center mb-3 ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>{t('modals.deleteConfirm')}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const newHistory = history.filter((_, idx) => idx !== editingEntry.index);
                        setHistory(newHistory);
                        setEditingEntry(null);
                        setShowDeleteConfirm(false);
                        showToast(t('toast.workoutDeleted'), 'success');
                      }}
                      className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black uppercase text-xs active:scale-95"
                    >{t('modals.delete')}</button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className={`flex-1 py-3 rounded-xl font-black uppercase text-xs ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'} active:scale-95`}
                    >{t('modals.cancel')}</button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
        );
      })()}

      {completionSummary && (
        <div role="dialog" aria-modal="true" aria-label="Workout complete" className={`fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/95' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className="p-5 rounded-full bg-emerald-500/10 text-emerald-500"><Trophy size={48} /></div></div>
            <h3 className={`text-2xl font-black uppercase tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('completion.complete', { name: t(`workout.type${completionSummary.workout.type}`) })}</h3>
            {completionSummary.workout.duration > 0 && <p className="text-slate-500 text-xs font-bold mb-6">{formatDuration(completionSummary.workout.duration, t)}</p>}
            <div className="space-y-3 mb-8">
              {completionSummary.workout.exercises.map(ex => {
                const passed = ex.setsCompleted.every(r => r === 5);
                const progressed = completionSummary.progressions.includes(ex.id);
                const deloadTo = completionSummary.deloads?.[ex.id];
                const StatusIcon = passed ? CheckCircle2 : deloadTo ? TrendingDown : MinusCircle;
                const statusColor = passed ? 'text-emerald-500' : deloadTo ? 'text-blue-500' : 'text-amber-500';
                const mutedColor = isDark ? 'text-slate-500' : 'text-slate-400';
                return (
                  <div key={ex.id} className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon size={18} className={statusColor} />
                        <span className={`text-sm font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('exercises.' + ex.id)}</span>
                      </div>
                      <span className="font-black text-sm">{ex.weight}kg</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pl-[30px]">
                      <span className="text-[10px] font-bold">
                        {ex.setsCompleted.map((r, i) => {
                          const val = r ?? 0;
                          const failed = val < 5;
                          return <React.Fragment key={i}>{i > 0 && <span className={mutedColor}> · </span>}<span className={failed && !passed ? statusColor : mutedColor}>{val}</span></React.Fragment>;
                        })}
                      </span>
                      {progressed && <span className="text-emerald-500 text-[10px] font-black">{t('completion.progressNext', { increment: ex.increment })}</span>}
                      {deloadTo && <span className="text-blue-500 text-[10px] font-black">{t('completion.deloadTo', { weight: deloadTo })}</span>}
                      {!passed && !progressed && !deloadTo && <span className="text-amber-500 text-[10px] font-black">{t('completion.sameWeight')}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setCompletionSummary(null)} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl active:scale-95">{t('completion.done')}</button>
          </div>
        </div>
      )}

      {showHelp && (
        <div role="dialog" aria-modal="true" aria-label="How it works" onClick={() => setShowHelp(false)} className={`fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/95' : 'bg-slate-500/50'}`}>
          <div onClick={e => e.stopPropagation()} className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`text-2xl font-black uppercase tracking-tight mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('help.title')}</h3>
            <div className="max-h-[60vh] overflow-y-auto space-y-5 mb-8 text-left">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Dumbbell size={18} /></div>
                <div><p className={`text-sm font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('help.programTitle')}</p><p className={`text-xs font-bold leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('help.programBody')}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-emerald-950/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}><TrendingUp size={18} /></div>
                <div><p className={`text-sm font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('help.progressionTitle')}</p><p className={`text-xs font-bold leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('help.progressionBody')}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-amber-950/40 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><MinusCircle size={18} /></div>
                <div><p className={`text-sm font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('help.stallTitle')}</p><p className={`text-xs font-bold leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('help.stallBody')}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}><TrendingDown size={18} /></div>
                <div><p className={`text-sm font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('help.deloadTitle')}</p><p className={`text-xs font-bold leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('help.deloadBody')}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Clock size={18} /></div>
                <div><p className={`text-sm font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('help.restTitle')}</p><p className={`text-xs font-bold leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('help.restBody')}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${isDark ? 'bg-amber-950/40 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><AlertCircle size={18} /></div>
                <div><p className={`text-sm font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('help.longBreaksTitle')}</p><p className={`text-xs font-bold leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('help.longBreaksBody')}</p></div>
              </div>
            </div>
            <button autoFocus onClick={() => setShowHelp(false)} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl active:scale-95">{t('help.gotIt')}</button>
          </div>
        </div>
      )}

      {pendingDriveRestore && (
        <div role="dialog" aria-modal="true" aria-label="Older backup warning" className={`fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/95' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500"><AlertCircle size={48} /></div></div>
            <h3 className={`text-2xl font-black uppercase tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('modals.olderBackupTitle')}</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-8">{t('modals.olderBackupBody', { cloudDate: pendingDriveRestore.cloudDate, localDate: pendingDriveRestore.localDate })}</p>
            <button onClick={() => { applyDriveRestore(pendingDriveRestore.data); setPendingDriveRestore(null); }} className="w-full py-5 bg-amber-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl active:scale-95 mb-4">{t('modals.restoreAnyway')}</button>
            <button onClick={() => setPendingDriveRestore(null)} className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 active:scale-90">{t('modals.cancel')}</button>
          </div>
        </div>
      )}

      {connectSyncPrompt && (
        <div role="dialog" aria-modal="true" aria-label="Sync prompt" className={`fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/95' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className="p-4 rounded-3xl bg-blue-500/10 text-blue-500"><Cloud size={48} /></div></div>
            <h3 className={`text-2xl font-black uppercase tracking-tight mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t(connectSyncPrompt.type === 'driveNewer' ? 'modals.driveNewerTitle' : 'modals.localNewerTitle')}
            </h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-8">
              {t(connectSyncPrompt.type === 'driveNewer' ? 'modals.driveNewerBody' : 'modals.localNewerBody', {
                cloudDate: connectSyncPrompt.cloudDate,
                localDate: connectSyncPrompt.localDate,
              })}
            </p>
            <button
              onClick={async () => {
                if (connectSyncPrompt.type === 'driveNewer') {
                  const result = await gdrive.restore(history);
                  if (result.success) {
                    applyDriveRestore(result.data);
                    showToast(t('toast.restoredFromDrive'), 'success');
                  }
                } else {
                  const result = await gdrive.save(getAppState());
                  if (result.success) showToast(t('toast.savedToDrive'), 'success');
                }
                setConnectSyncPrompt(null);
              }}
              className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl active:scale-95 mb-4"
            >
              {connectSyncPrompt.type === 'driveNewer' ? t('modals.restoreAnyway') : t('modals.overrideDrive')}
            </button>
            <button onClick={() => setConnectSyncPrompt(null)} className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 active:scale-90">{t('modals.cancel')}</button>
          </div>
        </div>
      )}

      {showRestoreSourcePicker && (
        <div role="dialog" aria-modal="true" aria-label="Restore source" className={`fixed inset-0 z-[500] flex items-center justify-center p-6 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/95' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <h3 className={`text-2xl font-black uppercase tracking-tight mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('modals.restoreTitle')}</h3>
            <div className="space-y-3 mb-6">
              <button
                onClick={() => { setShowRestoreSourcePicker(false); fileInputRef.current?.click(); }}
                className={`w-full p-5 rounded-2xl flex items-center gap-4 border active:scale-[0.98] transition-transform text-left ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <HardDrive size={24} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                <div><p className={`text-sm font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('modals.fromDevice')}</p><p className="text-[10px] font-bold text-slate-500">{t('modals.fromDeviceDesc')}</p></div>
              </button>
              <button
                onClick={handleDriveRestore}
                disabled={gdrive.isLoading}
                className={`w-full p-5 rounded-2xl flex items-center gap-4 border active:scale-[0.98] transition-transform text-left ${gdrive.isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <Cloud size={24} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                <div><p className={`text-sm font-black uppercase ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('modals.fromDrive')}</p><p className="text-[10px] font-bold text-slate-500">{t('modals.fromDriveDesc')}</p></div>
              </button>
            </div>
            <button onClick={() => setShowRestoreSourcePicker(false)} className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 active:scale-90">{t('modals.cancel')}</button>
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
