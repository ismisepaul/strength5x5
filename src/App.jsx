import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Dumbbell, History, Settings as SettingsIcon, Play, TrendingUp,
  Plus, Minus, RefreshCw, Sun, Moon, X, Download, Upload,
  ShieldCheck, ToggleRight, ToggleLeft, AlertCircle, Zap, TrendingDown,
  Clock, BellRing, Smartphone, Trash2, Bell, ChevronRight, Menu, Timer,
  FileSpreadsheet, MoveRight, Flame, ChevronDown
} from 'lucide-react';

import { WORKOUTS, EXERCISE_NAMES, INITIAL_WEIGHTS, STORAGE_KEY, SCHEMA_VERSION, EXPECTED_WEIGHT_KEYS, MAX_IMPORT_SIZE } from './constants';
import { validateImportData, calculateBest1RM, calculatePlates, calculateDeload } from './utils';
import { convertStrongliftsCSV } from './utils/convertStronglifts';
import { getExerciseTrend, getBig3Trend, getSessionStats, groupHistory } from './utils/chartData';
import { useLoadSaved, useSyncStorage, useStorageSync } from './hooks/useLocalStorage';
import { useTimer } from './hooks/useTimer';
import RestTimer from './components/RestTimer';
import ExerciseCard from './components/ExerciseCard';
import StatsChart from './components/StatsChart';

const App = () => {
  const saved = useLoadSaved();

  const [weights, setWeights] = useState(saved.weights ?? INITIAL_WEIGHTS);
  const [history, setHistory] = useState(Array.isArray(saved.history) ? saved.history : []);
  const [currentWorkoutType, setCurrentWorkoutType] = useState(saved.nextType ?? 'A');
  const [isDark, setIsDark] = useState(saved.isDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [autoSave, setAutoSave] = useState(saved.autoSave ?? true);
  const [preferredRest, setPreferredRest] = useState(saved.preferredRest ?? 90);
  const [soundEnabled, setSoundEnabled] = useState(saved.soundEnabled ?? false);
  const [vibrationEnabled, setVibrationEnabled] = useState(saved.vibrationEnabled ?? saved.hapticsEnabled ?? false);

  const [activeTab, setActiveTab] = useState('workout');
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [showPlateCalc, setShowPlateCalc] = useState(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [deloadAlert, setDeloadAlert] = useState(null);
  const [pendingDeloadWeights, setPendingDeloadWeights] = useState(null);
  const [expandedWarmups, setExpandedWarmups] = useState({});
  const [isExerciseComplete, setIsExerciseComplete] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const [pendingCSVImport, setPendingCSVImport] = useState(null);
  const [statsView, setStatsView] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [logGrouping, setLogGrouping] = useState('month');
  const [expandedGroups, setExpandedGroups] = useState({});

  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const audioCtxRef = useRef(null);
  const reverbRef = useRef(null);

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
    isDark, autoSave, preferredRest, soundEnabled, vibrationEnabled,
  });

  useStorageSync(STORAGE_KEY, (updated) => {
    if (updated.weights) setWeights(updated.weights);
    if (Array.isArray(updated.history)) setHistory(updated.history);
    if (updated.isDark !== undefined) setIsDark(updated.isDark);
  });

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

  const exportData = useCallback((targetHistory) => {
    const data = { app: 'Strength 5x5', version: SCHEMA_VERSION, weights, history: targetHistory || history, nextType: currentWorkoutType, isDark, autoSave, preferredRest, soundEnabled, vibrationEnabled };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'iron5x5_backup.json';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [weights, history, currentWorkoutType, isDark, autoSave, preferredRest, soundEnabled, vibrationEnabled]);

  const handleToggleWarmup = useCallback((id) => setExpandedWarmups(prev => ({ ...prev, [id]: !prev[id] })), []);

  const handleUpdateActiveWeight = useCallback((exIdx, diff) => {
    setCurrentSession(prev => prev ? ({ ...prev, exercises: prev.exercises.map((e, i) => i !== exIdx ? e : ({ ...e, weight: Math.max(0, e.weight + diff) })) }) : null);
  }, []);

  const handleToggleSet = useCallback((exIdx, setIdx) => {
    if (timer.isExpired) timer.reset();
    setNavExpanded(false);
    setCurrentSession(prev => {
      if (!prev) return prev;
      const ex = prev.exercises[exIdx];
      const currVal = ex.setsCompleted[setIdx];
      let nextVal = currVal === null ? 5 : currVal > 0 ? currVal - 1 : null;
      const isLastSet = setIdx === ex.setsCompleted.length - 1;
      const nextSession = { ...prev, exercises: prev.exercises.map((e, i) => i !== exIdx ? e : ({ ...e, setsCompleted: e.setsCompleted.map((r, j) => j === setIdx ? nextVal : r) })) };

      if (nextVal !== null) {
        if (isLastSet) { timer.stop(); setIsExerciseComplete(true); }
        else {
          setIsExerciseComplete(false);
          const req = nextVal === 5 ? preferredRest : 300;
          timer.start(req);
        }
      } else { timer.stop(); setIsExerciseComplete(false); }
      return nextSession;
    });
  }, [timer, preferredRest]);

  const finishWorkout = useCallback(() => {
    const nextWeights = { ...weights };
    currentSession.exercises.forEach(ex => { if (ex.setsCompleted.every(r => r === 5)) nextWeights[ex.id] = ex.weight + ex.increment; });
    const newHistory = [currentSession, ...history];
    setWeights(nextWeights); setHistory(newHistory);
    setCurrentWorkoutType(prev => prev === 'A' ? 'B' : 'A');
    setIsWorkoutActive(false); setCurrentSession(null);
    timer.reset(); setIsExerciseComplete(false);
    if (autoSave) exportData(newHistory);
  }, [currentSession, history, weights, autoSave, exportData, timer]);

  const cancelWorkout = useCallback(() => {
    setIsWorkoutActive(false); setCurrentSession(null);
    timer.reset(); setIsExerciseComplete(false); setShowCancelModal(false);
  }, [timer]);

  const initializeSession = useCallback((sessionWeights) => {
    setCurrentSession({ date: new Date().toISOString(), type: currentWorkoutType, exercises: WORKOUTS[currentWorkoutType].exercises.map(ex => ({ ...ex, weight: sessionWeights[ex.id], setsCompleted: new Array(ex.sets).fill(null) })) });
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
        setDeloadAlert([`${daysOff} days since last session. Safety deload (10%) recommended to reset form.`]);
        return;
      }
    }
    initializeSession(weights);
  }, [history, weights, initializeSession]);

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_SIZE) {
      console.warn('Import rejected: file exceeds 5MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target.result);
        const d = validateImportData(raw);
        if (!d) {
          console.warn('Import failed: invalid data structure');
          return;
        }
        setWeights(d.weights); setHistory(d.history);
        if (d.nextType) setCurrentWorkoutType(d.nextType);
        setIsDark(d.isDark ?? true); setAutoSave(d.autoSave ?? true);
        if (d.preferredRest) setPreferredRest(d.preferredRest);
        if (d.soundEnabled !== undefined) setSoundEnabled(d.soundEnabled);
        if (d.vibrationEnabled !== undefined) setVibrationEnabled(d.vibrationEnabled);
        setActiveTab('workout'); setShowRestorePrompt(false);
      } catch (err) {
        console.warn('Import failed:', err);
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
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = convertStrongliftsCSV(event.target.result);
        if (!result.history.length) {
          console.warn('StrongLifts import failed: no valid sessions found');
          return;
        }
        setPendingCSVImport(result);
      } catch (err) {
        console.warn('StrongLifts import failed:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const applyCSVImport = useCallback(() => {
    if (!pendingCSVImport) return;
    setWeights(pendingCSVImport.weights);
    setHistory(pendingCSVImport.history);
    setCurrentWorkoutType(pendingCSVImport.nextType);
    setPendingCSVImport(null);
    setShowRestorePrompt(false);
    setActiveTab('workout');
  }, [pendingCSVImport]);

  const getTopOffset = () => 0;

  const timerVisible = activeTab === 'workout' && (timer.isActive || timer.isExpired || isExerciseComplete);
  const navCollapsed = isWorkoutActive && activeTab === 'workout' && !navExpanded;
  const liveSessionVisible = isWorkoutActive && currentSession && activeTab !== 'workout';

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

  return (
    <div className={`min-h-screen flex flex-col font-sans max-w-md mx-auto relative transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>

      {activeTab === 'workout' && (
        <RestTimer
          seconds={timer.seconds} total={preferredRest}
          isDark={isDark} isExerciseComplete={isExerciseComplete} isExpired={timer.isExpired}
          onSkip={handleTimerSkip} navExpanded={navExpanded} elapsed={timer.elapsed}
        />
      )}

      {isWorkoutActive && currentSession && activeTab !== 'workout' && (() => {
        const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
        const liveDetail = timer.isExpired
          ? `Lifting · ${formatTime(timer.elapsed)}`
          : timer.isActive
            ? `Resting · ${formatTime(timer.seconds)}`
            : WORKOUTS[currentSession?.type]?.name || 'Active Session';
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
                  <p className="text-[10px] font-black uppercase text-white/60 leading-none mb-0.5">Live Session</p>
                  <p className={`text-xs font-black uppercase text-white tracking-tight ${timer.isActive || timer.isExpired ? 'font-mono' : ''}`}>{liveDetail}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black uppercase text-white/90 bg-black/10 px-3 py-1.5 rounded-lg">Return <ChevronRight size={12} /></div>
            </button>
          </div>
        );
      })()}

      <header className={`px-6 pt-10 pb-4 flex justify-between items-center transition-all duration-300 ${isDark ? 'bg-slate-950/80' : 'bg-slate-50/80'} backdrop-blur-md sticky z-40`} style={{ top: getTopOffset() }}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-600 shadow-lg"><Dumbbell className="text-white" size={20} /></div>
          <h1 className={`text-xl font-black tracking-tight uppercase ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Strength 5x5</h1>
        </div>
        <button onClick={() => setIsDark(!isDark)} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className={`p-2.5 rounded-2xl border transition-all ${isDark ? 'bg-slate-900 border-slate-800 text-yellow-400' : 'bg-white border-slate-100 text-slate-500'}`}>{isDark ? <Sun size={20} /> : <Moon size={20} />}</button>
      </header>

      <main className={`flex-1 px-4 py-4 overflow-y-auto ${timerVisible ? 'pb-44' : liveSessionVisible ? 'pb-52' : navCollapsed ? 'pb-24' : 'pb-32'}`}>
        {activeTab === 'workout' && (
          <div className="space-y-4">
            {!isWorkoutActive ? (
              <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="mb-6"><p className="text-[10px] font-bold uppercase text-slate-500 mb-1 tracking-widest">Next Up</p><button onClick={() => setCurrentWorkoutType(t => t === 'A' ? 'B' : 'A')} className="flex items-start gap-2 hover:opacity-70 transition-opacity"><h2 className="text-4xl font-black uppercase leading-tight">{WORKOUTS[currentWorkoutType].name}</h2><RefreshCw size={20} className="mt-3 text-indigo-500" /></button></div>
                <div className="space-y-3 mb-8">{WORKOUTS[currentWorkoutType].exercises.map(ex => (
                  <div key={ex.id} className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-transparent'}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex-1 pr-4"><p className={`font-black text-sm uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{ex.name}</p><p className="text-[10px] font-bold text-slate-500">{ex.sets}x{ex.reps}</p></div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setWeights({ ...weights, [ex.id]: Math.max(0, weights[ex.id] - ex.increment) })} aria-label={`Decrease ${ex.name} weight`} className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Minus size={14} /></button>
                        <span className="font-black w-12 text-center text-xl">{weights[ex.id]}</span>
                        <button onClick={() => setWeights({ ...weights, [ex.id]: weights[ex.id] + ex.increment })} aria-label={`Increase ${ex.name} weight`} className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Plus size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}</div>
                <button onClick={() => startWorkout()} disabled={trainedToday} className={`w-full py-5 rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl transition-transform ${trainedToday ? 'bg-slate-800 text-slate-600 opacity-40 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98]'}`}><Play size={20} fill="currentColor" /> Start Session</button>
                {trainedToday && <p className="text-slate-500 text-[10px] font-black uppercase text-center mt-3 tracking-widest">Already trained today</p>}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center mb-2"><h2 className="font-black uppercase tracking-widest text-slate-500">{currentSession ? WORKOUTS[currentSession.type]?.name : ''}</h2></div>
                {currentSession?.exercises.map((ex, exIdx) => (
                  <ExerciseCard key={ex.id} ex={ex} exIdx={exIdx} isDark={isDark} onToggleSet={handleToggleSet} onShowPlates={setShowPlateCalc} expanded={expandedWarmups[ex.id]} onToggleWarmup={handleToggleWarmup} onUpdateWeight={handleUpdateActiveWeight} />
                ))}
                <div className="pt-4 flex flex-col items-center">
                  <button onClick={finishWorkout} disabled={!currentSession?.exercises.every(ex => ex.setsCompleted.every(s => s !== null))} className={`w-full py-5 rounded-[1.5rem] font-black text-lg shadow-xl ${currentSession?.exercises.every(ex => ex.setsCompleted.every(s => s !== null)) ? 'bg-emerald-600 text-white active:scale-95 shadow-emerald-900/20' : 'bg-slate-800 text-slate-600 opacity-40 cursor-not-allowed'}`}>Finish Session</button>
                  {!currentSession?.exercises.every(ex => ex.setsCompleted.every(s => s !== null)) && <p className="text-slate-500 text-[10px] font-black uppercase text-center mt-3 tracking-widest animate-pulse">Complete all sets to finish</p>}
                  <button onClick={() => setShowCancelModal(true)} className={`mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-600 border-slate-900' : 'text-slate-400 border-slate-100'} px-6 py-3 border rounded-xl active:text-rose-500 transition-colors`}><Trash2 size={12} /> Discard Workout</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Workout Log</h2>
              <button
                onClick={() => {
                  const type = currentWorkoutType;
                  const session = {
                    date: new Date().toISOString(),
                    type,
                    exercises: WORKOUTS[type].exercises.map(ex => ({ ...ex, weight: weights[ex.id], setsCompleted: new Array(ex.sets).fill(5) })),
                  };
                  setEditingEntry({ index: -1, session });
                }}
                aria-label="Add workout"
                className={`p-2.5 rounded-xl border active:scale-90 transition-transform ${isDark ? 'bg-slate-900 border-slate-800 text-indigo-400' : 'bg-white border-slate-200 text-indigo-600 shadow-sm'}`}
              ><Plus size={20} /></button>
            </div>
            {(() => {
              const stats = getSessionStats(history);
              const flameColor = stats.streak > 0 ? 'text-amber-500' : 'text-slate-400';
              return (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-full ${i < stats.thisWeek ? 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.4)]' : (isDark ? 'bg-slate-700' : 'bg-slate-300')}`} />
                    ))}
                  </div>
                  <span className={`text-xs font-black uppercase ${stats.status.color === 'emerald' ? 'text-emerald-500' : stats.status.color === 'amber' ? 'text-amber-500' : 'text-rose-500'}`}>{stats.status.label}</span>
                  <span className="text-slate-500">·</span>
                  <span className="flex items-center gap-1">
                    <Flame size={12} className={flameColor} />
                    <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{stats.streak} {stats.streak === 1 ? 'week' : 'weeks'}</span>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{stats.total} total</span>
                </div>
              );
            })()}

            {history.length > 3 && (
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {[{ label: 'Week', val: 'week' }, { label: 'Month', val: 'month' }, { label: 'Year', val: 'year' }, { label: 'All', val: 'all' }].map(opt => (
                  <button key={opt.val} onClick={() => { setLogGrouping(opt.val); setExpandedGroups({}); }} className={`py-2 rounded-xl font-black text-[10px] uppercase tracking-wide transition-all ${logGrouping === opt.val ? 'bg-indigo-600 text-white shadow-lg' : (isDark ? 'bg-slate-900 text-slate-500 border border-slate-800' : 'bg-white text-slate-400 border border-slate-200')}`}>{opt.label}</button>
                ))}
              </div>
            )}

            {history.length === 0 ? (
              <p className="py-20 text-center text-slate-500 font-bold">No history found. Start training!</p>
            ) : (
              <>
                {history.slice(0, 3).map((s, i) => (
                  <button key={i} onClick={() => setEditingEntry({ index: i, session: JSON.parse(JSON.stringify(s)) })} className={`w-full text-left p-6 rounded-3xl border active:scale-[0.98] transition-transform ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-4"><span className={`text-xs font-black uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Workout {s.type}</span><span className="text-xs font-bold text-slate-500">{new Date(s.date).toLocaleDateString()}</span></div>
                    <div className="space-y-2">{s.exercises.map(ex => (<div key={ex.id} className="flex justify-between text-sm items-center"><span className="font-bold text-slate-400 uppercase text-[10px]">{ex.name}</span><div className="flex items-center gap-3"><span className="font-black">{ex.weight}kg</span><div className="flex gap-0.5">{ex.setsCompleted.map((r, ri) => (<div key={ri} className={`w-1.5 h-1.5 rounded-full ${r === 5 ? 'bg-indigo-500' : 'bg-rose-500'}`} />))}</div></div></div>))}</div>
                  </button>
                ))}

                {history.length > 3 && logGrouping === 'all' && history.slice(3).map((s, i) => (
                  <button key={i + 3} onClick={() => setEditingEntry({ index: i + 3, session: JSON.parse(JSON.stringify(s)) })} className={`w-full text-left p-6 rounded-3xl border active:scale-[0.98] transition-transform ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-4"><span className={`text-xs font-black uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Workout {s.type}</span><span className="text-xs font-bold text-slate-500">{new Date(s.date).toLocaleDateString()}</span></div>
                    <div className="space-y-2">{s.exercises.map(ex => (<div key={ex.id} className="flex justify-between text-sm items-center"><span className="font-bold text-slate-400 uppercase text-[10px]">{ex.name}</span><div className="flex items-center gap-3"><span className="font-black">{ex.weight}kg</span><div className="flex gap-0.5">{ex.setsCompleted.map((r, ri) => (<div key={ri} className={`w-1.5 h-1.5 rounded-full ${r === 5 ? 'bg-indigo-500' : 'bg-rose-500'}`} />))}</div></div></div>))}</div>
                  </button>
                ))}

                {history.length > 3 && logGrouping !== 'all' && groupHistory(history, logGrouping).map(group => (
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
                            <div className="flex justify-between items-center mb-4"><span className={`text-xs font-black uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Workout {s.type}</span><span className="text-xs font-bold text-slate-500">{new Date(s.date).toLocaleDateString()}</span></div>
                            <div className="space-y-2">{s.exercises.map(ex => (<div key={ex.id} className="flex justify-between text-sm items-center"><span className="font-bold text-slate-400 uppercase text-[10px]">{ex.name}</span><div className="flex items-center gap-3"><span className="font-black">{ex.weight}kg</span><div className="flex gap-0.5">{ex.setsCompleted.map((r, ri) => (<div key={ri} className={`w-1.5 h-1.5 rounded-full ${r === 5 ? 'bg-indigo-500' : 'bg-rose-500'}`} />))}</div></div></div>))}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="space-y-6">
            {history.length === 0 ? (
              <div className="py-20 text-center px-10">
                <div className="flex justify-center mb-6"><div className={`p-5 rounded-3xl ${isDark ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}><TrendingUp size={48} /></div></div>
                <h2 className="text-2xl font-black uppercase tracking-tight mb-2">No Stats Yet</h2>
                <p className="text-slate-500 text-sm font-bold leading-relaxed">Completed sessions populate analytics. Check back later.</p>
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
                      <div className="text-left"><h2 className="text-3xl font-black uppercase tracking-tighter">Peak Stats</h2></div>
                      <div className="flex items-center gap-2">
                        {big3Trend && <TrendIcon size={16} className={trendColor} />}
                        <div className="text-right"><p className="text-[10px] font-bold text-slate-500 uppercase">Big 3 Total</p><p className={`text-2xl font-black ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{big3Total}kg</p></div>
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
                      <div className="flex items-center gap-4 flex-1 min-w-0"><div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Zap size={20} /></div><div className="min-w-0 pr-2"><p className={`text-sm font-black uppercase truncate ${isDark ? 'text-indigo-100' : 'text-slate-900'}`}>{EXERCISE_NAMES[id]}</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-none">Est. 1RM: {best1RMs[id] || weights[id]}kg</p></div></div>
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
            <h2 className="text-3xl font-black mb-6 uppercase tracking-tighter">Options</h2>
            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Clock size={20} /></div>
                <div><p className="text-sm font-black uppercase tracking-tight">Rest Interval</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">Countdown target for standard sets</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: '1:30', val: 90 }, { label: '3:00', val: 180 }].map(opt => (
                  <button key={opt.val} onClick={() => setPreferredRest(opt.val)} className={`py-3 rounded-xl font-black text-xs transition-all ${preferredRest === opt.val ? 'bg-indigo-600 text-white shadow-lg' : (isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}`}>{opt.label}</button>
                ))}
              </div>
            </div>

            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Bell size={20} /></div>
                  <div><p className="text-sm font-black uppercase">Sound Alert</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">Ding when rest ends</p></div>
                </div>
                <button onClick={() => setSoundEnabled(!soundEnabled)} role="switch" aria-checked={soundEnabled} aria-label="Sound alert">{soundEnabled ? <ToggleRight size={48} className="text-indigo-500" /> : <ToggleLeft size={48} className={isDark ? 'text-slate-800' : 'text-slate-200'} />}</button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Smartphone size={20} /></div>
                  <div><p className="text-sm font-black uppercase">Vibration</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">Vibrate when rest ends</p></div>
                </div>
                <button onClick={() => setVibrationEnabled(!vibrationEnabled)} role="switch" aria-checked={vibrationEnabled} aria-label="Vibration">{vibrationEnabled ? <ToggleRight size={48} className="text-indigo-500" /> : <ToggleLeft size={48} className={isDark ? 'text-slate-800' : 'text-slate-200'} />}</button>
              </div>
            </div>

            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}><div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className={`p-3 rounded-2xl ${isDark ? 'bg-emerald-950/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}><ShieldCheck size={20} /></div><div><p className="text-sm font-black uppercase">Auto-Backup</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">JSON download after finish</p></div></div><button onClick={() => setAutoSave(!autoSave)} role="switch" aria-checked={autoSave} aria-label="Auto-backup">{autoSave ? <ToggleRight size={48} className="text-indigo-500" /> : <ToggleLeft size={48} className={isDark ? 'text-slate-800' : 'text-slate-200'} />}</button></div></div>
            <div className="grid grid-cols-2 gap-4"><button onClick={() => exportData()} className="p-5 rounded-[2rem] flex flex-col items-center gap-3 bg-indigo-600 text-white font-black uppercase text-[10px] shadow-lg active:scale-95 transition-transform"><Download size={24} /> Backup</button><button onClick={() => fileInputRef.current?.click()} className={`p-5 rounded-[2rem] flex flex-col items-center gap-3 border ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'} font-black uppercase text-[10px] active:scale-95`}><Upload size={24} /> Restore</button></div>
            <button onClick={() => csvInputRef.current?.click()} className={`w-full p-5 rounded-[2rem] flex items-center gap-4 border active:scale-[0.98] transition-transform ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className={`p-3 rounded-2xl ${isDark ? 'bg-amber-950/40 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><FileSpreadsheet size={20} /></div>
              <div className="text-left"><p className="text-sm font-black uppercase">Import StrongLifts</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">Upload your StrongLifts 5x5 CSV export</p></div>
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
          {[{ id: 'workout', label: 'Train', icon: Dumbbell }, { id: 'history', label: 'Log', icon: History }, { id: 'progress', label: 'Stats', icon: TrendingUp }, { id: 'settings', label: 'Options', icon: SettingsIcon }].map(tab => (
            <button key={tab.id} onClick={() => handleTabClick(tab.id)} aria-label={tab.label} className={`flex flex-col items-center gap-1.5 transition-all active:scale-125 ${activeTab === tab.id ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (isDark ? 'text-slate-700' : 'text-slate-300')}`}><tab.icon size={24} strokeWidth={activeTab === tab.id ? 3 : 2} /><span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span></button>
          ))}
        </nav>
      )}

      {showCancelModal && (
        <div role="dialog" aria-modal="true" aria-label="Discard session" className={`fixed inset-0 z-[500] flex items-center justify-center p-8 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/95' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-xs flex flex-col items-center p-8 rounded-[2.5rem] border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="p-5 rounded-full bg-rose-500/10 text-rose-500 mb-6"><Trash2 size={48} /></div>
            <h3 className={`text-2xl font-black uppercase mb-4 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Discard session?</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-10">Temporary logs for this session will be permanently deleted.</p>
            <button onClick={() => setShowCancelModal(false)} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-900/40 mb-6 active:scale-95">Keep Lifting</button>
            <button onClick={cancelWorkout} className="text-rose-500 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 active:scale-90">Yes, Discard Everything</button>
          </div>
        </div>
      )}

      {deloadAlert && (
        <div role="dialog" aria-modal="true" aria-label="Deload recommendation" className={`fixed inset-0 z-[400] flex items-center justify-center p-6 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/90' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500 animate-bounce"><TrendingDown size={48} /></div></div>
            <h3 className={`text-2xl font-black mb-4 uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Accept Deload?</h3>
            <div className="space-y-3 mb-8">{deloadAlert.map((r, i) => <p key={i} className="text-slate-400 text-xs font-bold leading-relaxed">{r}</p>)}</div>
            <button onClick={() => { setWeights(pendingDeloadWeights); initializeSession(pendingDeloadWeights); setPendingDeloadWeights(null); setDeloadAlert(null); }} className="w-full py-5 bg-amber-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl active:scale-95 mb-4">Accept & Lift</button>
            <button onClick={() => { initializeSession(weights); setPendingDeloadWeights(null); setDeloadAlert(null); }} className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 active:scale-90">Skip Deload</button>
          </div>
        </div>
      )}

      {showRestorePrompt && (
        <div role="dialog" aria-modal="true" aria-label="Restore backup" className={`fixed inset-0 z-[300] flex items-center justify-center p-6 text-center backdrop-blur-md ${isDark ? 'bg-slate-950/90' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className="p-4 rounded-3xl bg-indigo-500/10 text-indigo-500 animate-pulse"><AlertCircle size={48} /></div></div>
            <h3 className={`text-2xl font-black mb-2 uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Sync History?</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-10">Log empty. Restore a backup to maintain progress.</p>
            <div className="space-y-4">
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95"><Upload size={20} className="inline mr-2" /> Restore Backup</button>
              <button onClick={() => csvInputRef.current?.click()} className={`w-full py-5 rounded-2xl font-black uppercase text-sm active:scale-95 border ${isDark ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}><FileSpreadsheet size={20} className="inline mr-2" /> Import StrongLifts</button>
              <button onClick={() => startWorkout(true)} className="text-[10px] font-black uppercase text-slate-700 tracking-[0.3em] mt-8 block mx-auto">Skip and start fresh</button>
            </div>
          </div>
        </div>
      )}

      {showPlateCalc && (
        <div role="dialog" aria-modal="true" aria-label="Plate calculator" className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm ${isDark ? 'bg-slate-950/80' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <button onClick={() => setShowPlateCalc(null)} aria-label="Close plate calculator" className={`absolute top-4 right-4 p-2 rounded-full ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}><X size={20} /></button>
            <div className="text-center mb-8"><h3 className={`text-3xl font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>{showPlateCalc.weight} KG</h3><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Plates Per Side (20kg Bar)</p></div>
            <div className="flex flex-wrap justify-center gap-3 mb-8">{plates.map((p, i) => (<div key={i} className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center font-black ${p >= 20 ? 'bg-indigo-600 border-indigo-500 text-white' : p >= 10 ? 'bg-slate-800 border-slate-700 text-white' : (isDark ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400')}`}><span className="text-[10px] opacity-50 leading-none">KG</span><span>{p}</span></div>))}</div>
            <button onClick={() => setShowPlateCalc(null)} className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'}`}>Close</button>
          </div>
        </div>
      )}

      {pendingCSVImport && (
        <div role="dialog" aria-modal="true" aria-label="Confirm StrongLifts import" className={`fixed inset-0 z-[300] flex items-center justify-center p-6 text-center backdrop-blur-md ${isDark ? 'bg-slate-950/90' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className={`p-4 rounded-3xl ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><FileSpreadsheet size={48} /></div></div>
            <h3 className={`text-2xl font-black mb-2 uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Import StrongLifts Data?</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-6">Found <span className={isDark ? 'text-indigo-400' : 'text-indigo-600'}>{pendingCSVImport.history.length}</span> sessions</p>
            <div className="grid grid-cols-2 gap-2 mb-8">
              {EXPECTED_WEIGHT_KEYS.map(id => (
                <div key={id} className={`p-3 rounded-xl text-left ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-1">{EXERCISE_NAMES[id]}</p>
                  <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{pendingCSVImport.weights[id]}kg</p>
                </div>
              ))}
            </div>
            <button onClick={applyCSVImport} className="w-full py-5 bg-amber-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95 mb-4">Import</button>
            <button onClick={() => setPendingCSVImport(null)} className="text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-300 active:scale-90">Cancel</button>
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
              <h3 className={`text-xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{isNewEntry ? 'Add Workout' : 'Edit Workout'}</h3>
              <button onClick={() => { setEditingEntry(null); setShowDeleteConfirm(false); }} aria-label="Close edit modal" className={`p-2 rounded-full ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}><X size={20} /></button>
            </div>

            {isNewEntry && (
              <div className="mb-6">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">Workout Type</label>
                <div className="flex gap-2">
                  {['A', 'B'].map(t => (
                    <button
                      key={t}
                      onClick={() => setEditingEntry(prev => ({
                        ...prev,
                        session: {
                          ...prev.session,
                          type: t,
                          exercises: WORKOUTS[t].exercises.map(ex => ({ ...ex, weight: weights[ex.id], setsCompleted: new Array(ex.sets).fill(5) })),
                        },
                      }))}
                      className={`flex-1 py-3 rounded-xl font-black uppercase text-sm transition-all ${editingEntry.session.type === t ? 'bg-indigo-600 text-white shadow-lg' : (isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-100 text-slate-500 border border-slate-200')}`}
                    >Workout {t}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">Date</label>
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
              {dateConflict && <p className="text-rose-500 text-xs font-bold mt-2">A workout already exists on this date</p>}
              {isFutureDate && <p className="text-rose-500 text-xs font-bold mt-2">Date cannot be in the future</p>}
            </div>

            <div className="space-y-4 mb-8">
              {editingEntry.session.exercises.map((ex, exIdx) => (
                <div key={ex.id} className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                  <p className={`font-black text-xs uppercase mb-3 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{ex.name}</p>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Weight</span>
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
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Sets</span>
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
                if (isNewEntry) {
                  const newHistory = [...history, editingEntry.session].sort((a, b) => new Date(b.date) - new Date(a.date));
                  setHistory(newHistory);
                } else {
                  const newHistory = [...history];
                  newHistory[editingEntry.index] = editingEntry.session;
                  setHistory(newHistory);
                }
                setEditingEntry(null);
              }}
              className={`w-full py-4 rounded-2xl font-black uppercase text-sm shadow-xl mb-4 ${dateConflict || isFutureDate ? 'bg-slate-800 text-slate-600 opacity-40 cursor-not-allowed' : 'bg-indigo-600 text-white active:scale-95'}`}
            >{isNewEntry ? 'Add Workout' : 'Save Changes'}</button>

            {!isNewEntry && (
              !showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-500 tracking-widest py-3 active:scale-90"
                ><Trash2 size={12} /> Delete Workout</button>
              ) : (
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-rose-950/20 border-rose-900/30' : 'bg-rose-50 border-rose-200'}`}>
                  <p className={`text-xs font-bold text-center mb-3 ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>Delete this workout? This cannot be undone.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const newHistory = history.filter((_, idx) => idx !== editingEntry.index);
                        setHistory(newHistory);
                        setEditingEntry(null);
                        setShowDeleteConfirm(false);
                      }}
                      className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black uppercase text-xs active:scale-95"
                    >Delete</button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className={`flex-1 py-3 rounded-xl font-black uppercase text-xs ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'} active:scale-95`}
                    >Cancel</button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
        );
      })()}

      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
      <input type="file" ref={csvInputRef} onChange={handleStrongliftsImport} accept=".csv" className="hidden" />
    </div>
  );
};

export default App;
