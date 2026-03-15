import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Dumbbell, History, Settings as SettingsIcon, Play, CheckCircle2, Timer, 
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, XCircle, TrendingUp, 
  Plus, Minus, RefreshCw, Sun, Moon, X, Calendar, Download, Upload, 
  ShieldCheck, ToggleRight, ToggleLeft, AlertCircle, Zap, TrendingDown,
  Clock, BellRing, Smartphone, Trash2, Bell
} from 'lucide-react';

// --- 1. Module-Scoped Constants ---
const WORKOUTS = {
  A: { name: 'Workout A', exercises: [
    { id: 'squat', name: 'Back Squat', sets: 5, reps: 5, increment: 2.5 },
    { id: 'bench', name: 'Bench Press', sets: 5, reps: 5, increment: 2.5 },
    { id: 'row', name: 'Barbell Row', sets: 5, reps: 5, increment: 2.5 },
  ]},
  B: { name: 'Workout B', exercises: [
    { id: 'squat', name: 'Back Squat', sets: 5, reps: 5, increment: 2.5 },
    { id: 'press', name: 'Overhead Press', sets: 5, reps: 5, increment: 2.5 },
    { id: 'deadlift', name: 'Deadlift', sets: 1, reps: 5, increment: 5 },
  ]}
};

const EXERCISE_NAMES = {
  squat: 'Back Squat',
  bench: 'Bench Press',
  row: 'Barbell Row',
  press: 'Overhead Press',
  deadlift: 'Deadlift'
};

const INITIAL_WEIGHTS = { squat: 20, bench: 20, row: 30, press: 20, deadlift: 40 };
const STORAGE_KEY = 'iron5x5_v34_final';

// --- Helper Components ---

const RestTimer = React.memo(({ seconds, total, active, isDark, onSkip, isExerciseComplete, isRestOver }) => {
  if (seconds <= 0 && !isExerciseComplete && !isRestOver) return null;
  const progress = (isExerciseComplete || isRestOver) ? 100 : (seconds / total) * 100;
  
  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 transform translate-y-0 ${isDark ? 'bg-slate-900 border-b border-slate-800' : 'bg-white border-b border-slate-200'} shadow-2xl`}>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 linear ${isExerciseComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
          style={{ width: `${progress}%` }} 
        />
      </div>
      <div className="py-4 px-6 flex justify-between items-center">
        {isExerciseComplete ? (
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest leading-none mb-1">Movement Finished</span>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-500" />
              <span className={`text-[11px] font-bold leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Setup next exercise.<br/>No rest required.</span>
            </div>
          </div>
        ) : isRestOver ? (
          <div className="flex flex-col">
            <span className={`text-[10px] font-black uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'} tracking-widest animate-pulse leading-none mb-1`}>Get to the bar</span>
            <div className="flex items-center gap-3">
              <BellRing size={20} className={isDark ? 'text-indigo-500' : 'text-indigo-600'} />
              <span className={`text-sm font-black uppercase italic ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Rest Over! Start your next set</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">Recovery Phase</span>
            <div className="flex items-center gap-3">
              <Timer size={24} className={isDark ? 'text-indigo-500' : 'text-indigo-600'} />
              <span className={`text-4xl font-black font-mono leading-none ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{Math.floor(seconds/60)}:{(seconds%60).toString().padStart(2,'0')}</span>
            </div>
          </div>
        )}
        <button 
          onClick={onSkip} 
          className={`px-6 py-2.5 rounded-2xl font-black text-xs uppercase transition-all active:scale-95 ${isExerciseComplete ? 'bg-emerald-500/10 text-emerald-500' : isRestOver ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-rose-500/10 text-rose-500'}`}
        >
          {isExerciseComplete ? 'Got it' : isRestOver ? 'Start' : 'Skip'}
        </button>
      </div>
    </div>
  );
});

const ExerciseCard = React.memo(({ ex, exIdx, isDark, onToggleSet, onShowPlates, expanded, onToggleWarmup, onUpdateWeight }) => {
  return (
    <div className={`p-6 rounded-[2.5rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className={`font-black text-lg truncate uppercase tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{ex.name}</h3>
          <button onClick={() => onToggleWarmup(ex.id)} className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-lg mt-1 transition-colors ${expanded ? 'bg-indigo-600 text-white' : isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />} Warmup
          </button>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button onClick={() => onUpdateWeight(exIdx, -ex.increment)} className={`p-1.5 rounded-lg border ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Minus size={12}/></button>
            <span className={`text-2xl font-black ${isDark ? 'text-indigo-400' : 'text-indigo-600'} leading-none`}>{ex.weight}kg</span>
            <button onClick={() => onUpdateWeight(exIdx, ex.increment)} className={`p-1.5 rounded-lg border ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Plus size={12}/></button>
          </div>
          <button onClick={() => onShowPlates(ex)} className="text-[10px] font-black block uppercase text-slate-500 mt-1">Plates</button>
        </div>
      </div>
      {expanded && (
        <div className={`mb-6 p-4 rounded-2xl ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1"><span>Empty Bar</span><span>20kg × 5</span></div>
          <div className="flex justify-between text-xs font-bold text-slate-500"><span>Working Prep</span><span>{Math.round(ex.weight * 0.6 / 2.5) * 2.5}kg × 3</span></div>
        </div>
      )}
      <div className="flex justify-between gap-2 items-center">
        {ex.setsCompleted.map((r, ri) => (
          <button key={ri} onClick={() => onToggleSet(exIdx, ri)} className={`flex-1 aspect-square rounded-xl flex items-center justify-center border-4 transition-all touch-manipulation active:scale-90 ${r !== null ? (r === 5 ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-rose-500 border-rose-600 text-white') : (isDark ? 'bg-slate-950 border-slate-800 text-slate-800' : 'bg-white border-slate-100 text-slate-200')}`}><span className="text-xl font-black">{r !== null ? r : ri + 1}</span></button>
        ))}
        {ex.sets === 1 && <div className="flex-[3] text-center font-black uppercase text-slate-600 text-[10px] tracking-widest">1x5 Target</div>}
      </div>
    </div>
  );
});

// --- Main Application ---

const App = () => {
  // Lazy State Initializers
  const [weights, setWeights] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).weights || INITIAL_WEIGHTS : INITIAL_WEIGHTS;
    } catch { return INITIAL_WEIGHTS; }
  });

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return (parsed && Array.isArray(parsed.history)) ? parsed.history : [];
    } catch { return []; }
  });

  const [currentWorkoutType, setCurrentWorkoutType] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).nextType || 'A' : 'A';
    } catch { return 'A'; }
  });

  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).isDark ?? true : true;
    } catch { return true; }
  });

  const [autoSave, setAutoSave] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).autoSave ?? true : true;
    } catch { return true; }
  });

  const [preferredRest, setPreferredRest] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).preferredRest || 90 : 90;
    } catch { return 90; }
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).soundEnabled ?? false : false;
    } catch { return false; }
  });

  const [vibrationEnabled, setVibrationEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed ? (parsed.vibrationEnabled ?? parsed.hapticsEnabled ?? false) : false;
    } catch { return false; }
  });

  // Transient State
  const [activeTab, setActiveTab] = useState('workout'); 
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [showPlateCalc, setShowPlateCalc] = useState(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [deloadAlert, setDeloadAlert] = useState(null);
  const [pendingDeloadWeights, setPendingDeloadWeights] = useState(null);
  const [expandedWarmups, setExpandedWarmups] = useState({});
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [currentTotalRest, setCurrentTotalRest] = useState(90);
  const [isExerciseComplete, setIsExerciseComplete] = useState(false);
  const [isRestOver, setIsRestOver] = useState(false);
  
  const fileInputRef = useRef(null);
  const audioCtxRef = useRef(null);
  const reverbRef = useRef(null);

  // --- Audio Engine ---
  const initReverb = useCallback((ctx) => {
    if (reverbRef.current) return;
    const duration = 2;
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    reverbRef.current = convolver;
  }, []);

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        initReverb(audioCtxRef.current);
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") { ctx.resume(); }

      const now = ctx.currentTime;
      const mainGain = ctx.createGain();
      const dryGain = ctx.createGain();
      const reverbGain = ctx.createGain();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.value = 1358;
      osc2.frequency.value = 2844;

      osc1.connect(mainGain);
      osc2.connect(mainGain);
      mainGain.connect(dryGain);
      mainGain.connect(reverbGain);
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

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } catch (e) {}
  }, [initReverb]);

  // Sync to Storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      weights, history, nextType: currentWorkoutType, isDark, autoSave, 
      preferredRest, soundEnabled, vibrationEnabled
    }));
  }, [weights, history, currentWorkoutType, isDark, autoSave, preferredRest, soundEnabled, vibrationEnabled]);

  // Timer Tick loop
  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimerSeconds(s => {
        if (s <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          setIsRestOver(true);
          if (soundEnabled) playChime();
          if (vibrationEnabled && navigator?.vibrate) { navigator.vibrate([200, 100, 200]); }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, soundEnabled, vibrationEnabled, playChime]);

  // Derived Helpers
  const historyDaysSet = useMemo(() => new Set(history.map(h => new Date(h.date).toDateString())), [history]);
  const big3Total = useMemo(() => (weights?.squat || 0) + (weights?.bench || 0) + (weights?.deadlift || 0), [weights]);
  const plates = useMemo(() => {
    if (!showPlateCalc?.weight) return [];
    let side = (showPlateCalc.weight - 20) / 2;
    const res = [];
    if (side <= 0) return [];
    for (const p of [25, 20, 15, 10, 5, 2.5, 1.25]) {
      while (side >= p) { res.push(p); side -= p; }
    }
    return res;
  }, [showPlateCalc?.weight]);

  const calculate1RM = useCallback((weight, reps) => (!reps || reps <= 0) ? weight : Math.round(weight * (1 + reps / 30)), []);

  const exportData = useCallback((targetHistory) => {
    const data = { app: "Strength 5x5", weights, history: targetHistory || history, nextType: currentWorkoutType, isDark, autoSave, preferredRest, soundEnabled, vibrationEnabled };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `iron5x5_backup.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }, [weights, history, currentWorkoutType, isDark, autoSave, preferredRest, soundEnabled, vibrationEnabled]);

  const handleToggleWarmup = useCallback((id) => setExpandedWarmups(prev => ({ ...prev, [id]: !prev[id] })), []);
  
  const handleUpdateActiveWeight = useCallback((exIdx, diff) => {
    setCurrentSession(prev => prev ? ({ ...prev, exercises: prev.exercises.map((e, i) => i !== exIdx ? e : ({ ...e, weight: Math.max(0, e.weight + diff) })) }) : null);
  }, []);

  const handleToggleSet = useCallback((exIdx, setIdx) => {
    setIsRestOver(false);
    setCurrentSession(prev => {
      if (!prev) return prev;
      const ex = prev.exercises[exIdx];
      const currVal = ex.setsCompleted[setIdx];
      let nextVal = currVal === null ? 5 : currVal > 0 ? currVal - 1 : null;
      const isLastSet = setIdx === ex.setsCompleted.length - 1;
      const nextSession = { ...prev, exercises: prev.exercises.map((e, i) => i !== exIdx ? e : ({ ...e, setsCompleted: e.setsCompleted.map((r, j) => j === setIdx ? nextVal : r) })) };
      
      if (nextVal !== null) {
        if (isLastSet) { setTimerSeconds(0); setTimerActive(false); setIsExerciseComplete(true); }
        else { 
            setIsExerciseComplete(false); 
            const req = nextVal === 5 ? preferredRest : 300;
            if (!timerActive || currentTotalRest !== req) { setTimerSeconds(req); setCurrentTotalRest(req); setTimerActive(true); }
        }
      } else { setTimerSeconds(0); setTimerActive(false); setIsExerciseComplete(false); }
      return nextSession;
    });
  }, [timerActive, currentTotalRest, preferredRest]);

  const finishWorkout = useCallback(() => {
    const nextWeights = { ...weights };
    currentSession.exercises.forEach(ex => { if (ex.setsCompleted.every(r => r === 5)) nextWeights[ex.id] = ex.weight + ex.increment; });
    const newHistory = [currentSession, ...history];
    setWeights(nextWeights); setHistory(newHistory);
    setCurrentWorkoutType(prev => prev === 'A' ? 'B' : 'A');
    setIsWorkoutActive(false); setCurrentSession(null);
    setTimerActive(false); setTimerSeconds(0); setIsExerciseComplete(false); setIsRestOver(false);
    if (autoSave) exportData(newHistory);
  }, [currentSession, history, weights, autoSave, exportData]);

  const cancelWorkout = useCallback(() => {
    setIsWorkoutActive(false); setCurrentSession(null); setTimerActive(false); setTimerSeconds(0);
    setIsExerciseComplete(false); setIsRestOver(false); setShowCancelModal(false);
  }, []);

  const initializeSession = useCallback((sessionWeights) => {
    setCurrentSession({ date: new Date().toISOString(), type: currentWorkoutType, exercises: WORKOUTS[currentWorkoutType].exercises.map(ex => ({ ...ex, weight: sessionWeights[ex.id], setsCompleted: new Array(ex.sets).fill(null) })) });
    setIsWorkoutActive(true); setActiveTab('workout'); setExpandedWarmups({}); setShowRestorePrompt(false); setIsExerciseComplete(false); setIsRestOver(false);
  }, [currentWorkoutType]);

  const startWorkout = useCallback((force = false) => {
    if (history.length === 0 && !force) { setShowRestorePrompt(true); return; }
    if (history.length > 0) {
      const last = new Date(history[0].date);
      const daysOff = Math.floor((new Date() - last) / 86400000);
      if (daysOff >= 14) {
        const newW = { ...weights };
        Object.keys(newW).forEach(id => { newW[id] = Math.max(20, Math.round((newW[id] * 0.9) / 2.5) * 2.5); });
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
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const d = JSON.parse(event.target.result);
        if (d.weights && d.history) {
          setWeights(d.weights); setHistory(d.history);
          if (d.nextType) setCurrentWorkoutType(d.nextType);
          setIsDark(d.isDark ?? true); setAutoSave(d.autoSave ?? true);
          if (d.preferredRest) setPreferredRest(d.preferredRest);
          if (d.soundEnabled !== undefined) setSoundEnabled(d.soundEnabled);
          if (d.vibrationEnabled !== undefined) setVibrationEnabled(d.vibrationEnabled);
          setActiveTab('workout'); setShowRestorePrompt(false);
        }
      } catch { }
    };
    reader.readAsText(file);
  };

  const getTopOffset = () => {
    let offset = 0;
    if (timerActive || isRestOver || isExerciseComplete) offset += 84;
    if (isWorkoutActive && currentSession && activeTab !== 'workout') offset += 60;
    return offset;
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans max-w-md mx-auto relative transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      <RestTimer 
        seconds={timerSeconds} total={currentTotalRest} active={timerActive} 
        isDark={isDark} isExerciseComplete={isExerciseComplete} isRestOver={isRestOver}
        onSkip={() => {
            if (audioCtxRef.current?.state === "suspended") { audioCtxRef.current.resume(); }
            setTimerSeconds(0); setTimerActive(false); setIsExerciseComplete(false); setIsRestOver(false);
        }} 
      />

      {isWorkoutActive && currentSession && activeTab !== 'workout' && (
        <div className={`fixed top-0 left-0 right-0 z-[100] shadow-lg transition-all duration-300 ${isRestOver ? 'bg-indigo-500' : isDark ? 'bg-indigo-900' : 'bg-indigo-600'}`}>
          <button onClick={() => setActiveTab('workout')} className="w-full px-6 py-4 flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-white/20">
                {isRestOver ? <BellRing size={14} className="text-white animate-bounce" /> : <Play size={14} fill="currentColor" className="text-white" />}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-white/60 leading-none mb-0.5">Live Session</p>
                <p className={`text-xs font-black uppercase text-white tracking-tight`}>{isRestOver ? "Rest Over!" : WORKOUTS[currentSession?.type]?.name || "Active Session"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black uppercase text-white/90 bg-black/10 px-3 py-1.5 rounded-lg">Return <ChevronRight size={12} /></div>
          </button>
        </div>
      )}

      <header className={`px-6 pt-10 pb-4 flex justify-between items-center transition-all duration-300 ${isDark ? 'bg-slate-950/80' : 'bg-slate-50/80'} backdrop-blur-md sticky z-40`} style={{ top: getTopOffset() }}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-600 shadow-lg"><Dumbbell className="text-white" size={20} /></div>
          <h1 className={`text-xl font-black tracking-tight uppercase ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Strength 5x5</h1>
        </div>
        <button onClick={() => setIsDark(!isDark)} className={`p-2.5 rounded-2xl border transition-all ${isDark ? 'bg-slate-900 border-slate-800 text-yellow-400' : 'bg-white border-slate-100 text-slate-500'}`}>{isDark ? <Sun size={20} /> : <Moon size={20} />}</button>
      </header>

      <main className="flex-1 px-4 py-4 overflow-y-auto pb-32">
        {activeTab === 'workout' && (
          <div className="space-y-4">
            {!isWorkoutActive ? (
              <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="mb-6"><p className="text-[10px] font-bold uppercase text-slate-500 mb-1 tracking-widest">Next Up</p><button onClick={() => setCurrentWorkoutType(t => t==='A'?'B':'A')} className="flex items-start gap-2 hover:opacity-70 transition-opacity"><h2 className="text-4xl font-black uppercase leading-tight">{WORKOUTS[currentWorkoutType].name}</h2><RefreshCw size={20} className="mt-3 text-indigo-500" /></button></div>
                <div className="space-y-3 mb-8">{WORKOUTS[currentWorkoutType].exercises.map(ex => (
                  <div key={ex.id} className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-transparent'}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex-1 pr-4"><p className={`font-black text-sm uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{ex.name}</p><p className="text-[10px] font-bold text-slate-500">{ex.sets}x{ex.reps}</p></div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setWeights({...weights, [ex.id]: Math.max(0, weights[ex.id]-ex.increment)})} className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Minus size={14}/></button>
                        <span className="font-black w-12 text-center text-xl">{weights[ex.id]}</span>
                        <button onClick={() => setWeights({...weights, [ex.id]: weights[ex.id]+ex.increment})} className={`p-2 rounded-xl border ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Plus size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}</div>
                <button onClick={() => startWorkout()} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] transition-transform"><Play size={20} fill="currentColor" /> Start Session</button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center mb-2"><h2 className="font-black uppercase tracking-widest text-slate-500">{currentSession ? WORKOUTS[currentSession.type]?.name : ""}</h2></div>
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

        {/* HUB TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-3xl font-black mb-6 uppercase tracking-tighter">Strength Hub</h2>
            <div className={`p-5 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <p className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest flex items-center gap-2"><Calendar size={12} className={isDark ? 'text-indigo-500' : 'text-indigo-600'} /> Momentum</p>
              <div className="flex gap-1.5 flex-wrap justify-center">{Array.from({ length: 84 }).map((_, i) => {
                const d = new Date(); d.setDate(d.getDate() - (83 - i));
                const hit = historyDaysSet.has(d.toDateString());
                return <div key={i} className={`w-3 h-3 rounded-sm ${hit ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]' : (isDark ? 'bg-slate-800' : 'bg-slate-200')}`} />
              })}</div>
            </div>
            {history.length === 0 ? (
                <p className="py-20 text-center text-slate-500 font-bold">No history found. Start training!</p>
            ) : (
                history.map((s, i) => (
                    <div key={i} className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <div className="flex justify-between items-center mb-4"><span className={`text-xs font-black uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Workout {s.type}</span><span className="text-xs font-bold text-slate-500">{new Date(s.date).toLocaleDateString()}</span></div>
                        <div className="space-y-2">{s.exercises.map(ex => (<div key={ex.id} className="flex justify-between text-sm items-center"><span className="font-bold text-slate-400 uppercase text-[10px]">{ex.name}</span><div className="flex items-center gap-3"><span className="font-black">{ex.weight}kg</span><div className="flex gap-0.5">{ex.setsCompleted.map((r, ri) => (<div key={ri} className={`w-1.5 h-1.5 rounded-full ${r === 5 ? 'bg-indigo-500' : 'bg-rose-500'}`} />))}</div></div></div>))}</div>
                    </div>
                ))
            )}
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            {history.length === 0 ? (
                <div className="py-20 text-center px-10">
                    <div className="flex justify-center mb-6"><div className={`p-5 rounded-3xl ${isDark ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}><TrendingUp size={48} /></div></div>
                    <h2 className="text-2xl font-black uppercase tracking-tight mb-2">No Stats Yet</h2>
                    <p className="text-slate-500 text-sm font-bold leading-relaxed">Completed sessions populate analytics. Check back later.</p>
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-end mb-4"><h2 className="text-3xl font-black uppercase tracking-tighter">Peak Stats</h2><div className="text-right"><p className="text-[10px] font-bold text-slate-500 uppercase">Big 3 Total</p><p className={`text-2xl font-black ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{big3Total}kg</p></div></div>
                    <div className="grid gap-3">{Object.keys(INITIAL_WEIGHTS).map(id => {
                        const last = history.find(h => h.exercises.some(e => e.id === id));
                        const best = (last?.exercises?.find(e => e.id === id)?.setsCompleted && last.exercises.find(e => e.id === id).setsCompleted.length > 0) ? Math.max(...last.exercises.find(e => e.id === id).setsCompleted) : 0;
                        return (
                        <div key={id} className={`p-6 rounded-[2rem] border flex justify-between items-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="flex items-center gap-4 flex-1 min-w-0"><div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Zap size={20} /></div><div className="min-w-0 pr-2"><p className={`text-sm font-black uppercase truncate ${isDark ? 'text-indigo-100' : 'text-slate-900'}`}>{EXERCISE_NAMES[id]}</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-none">Est. 1RM: {calculate1RM(weights[id], best)}kg</p></div></div>
                            <div className={`shrink-0 font-black text-xl ${isDark ? 'text-indigo-500' : 'text-indigo-600'}`}>{weights[id]}kg</div>
                        </div>
                        )})}
                    </div>
                </>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black mb-6 uppercase tracking-tighter">Options</h2>
            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Clock size={20} /></div>
                <div><p className="text-sm font-black uppercase tracking-tight">Rest Interval</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">Countdown target for standard sets</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[ { label: '0:03', val: 3 }, { label: '1:30', val: 90 }, { label: '3:00', val: 180 } ].map(opt => (
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
                <button onClick={() => setSoundEnabled(!soundEnabled)}>{soundEnabled ? <ToggleRight size={48} className="text-indigo-500" /> : <ToggleLeft size={48} className={isDark ? 'text-slate-800' : 'text-slate-200'} />}</button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isDark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Smartphone size={20} /></div>
                    <div><p className="text-sm font-black uppercase">Vibration</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">Vibrate when rest ends</p></div>
                </div>
                <button onClick={() => setVibrationEnabled(!vibrationEnabled)}>{vibrationEnabled ? <ToggleRight size={48} className="text-indigo-500" /> : <ToggleLeft size={48} className={isDark ? 'text-slate-800' : 'text-slate-200'} />}</button>
              </div>
            </div>

            <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}><div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className={`p-3 rounded-2xl ${isDark ? 'bg-emerald-950/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}><ShieldCheck size={20} /></div><div><p className="text-sm font-black uppercase">Auto-Backup</p><p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">JSON download after finish</p></div></div><button onClick={() => setAutoSave(!autoSave)}>{autoSave ? <ToggleRight size={48} className="text-indigo-500" /> : <ToggleLeft size={48} className={isDark ? 'text-slate-800' : 'text-slate-200'} />}</button></div></div>
            <div className="grid grid-cols-2 gap-4"><button onClick={() => exportData()} className="p-5 rounded-[2rem] flex flex-col items-center gap-3 bg-indigo-600 text-white font-black uppercase text-[10px] shadow-lg active:scale-95 transition-transform"><Download size={24}/> Backup</button><button onClick={() => fileInputRef.current?.click()} className={`p-5 rounded-[2rem] flex flex-col items-center gap-3 border ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'} font-black uppercase text-[10px] active:scale-95`}><Upload size={24}/> Restore</button></div>
          </div>
        )}
      </main>

      <nav className={`fixed bottom-0 left-0 right-0 border-t px-6 py-6 flex justify-between items-center max-w-md mx-auto z-20 backdrop-blur-lg ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]'}`}>
        {[ { id: 'workout', label: 'Train', icon: Dumbbell }, { id: 'history', label: 'Hub', icon: History }, { id: 'progress', label: 'Stats', icon: TrendingUp }, { id: 'settings', label: 'Options', icon: SettingsIcon } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1.5 transition-all active:scale-125 ${activeTab === tab.id ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (isDark ? 'text-slate-700' : 'text-slate-300')}`}><tab.icon size={24} strokeWidth={activeTab === tab.id ? 3 : 2} /><span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span></button>
        ))}
      </nav>

      {/* DISCARD MODAL */}
      {showCancelModal && (
        <div className={`fixed inset-0 z-[500] flex items-center justify-center p-8 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/95' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-xs flex flex-col items-center p-8 rounded-[2.5rem] border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="p-5 rounded-full bg-rose-500/10 text-rose-500 mb-6"><Trash2 size={48} /></div>
            <h3 className={`text-2xl font-black uppercase mb-4 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Discard session?</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-10">Temporary logs for this session will be permanently deleted.</p>
            <button onClick={() => setShowCancelModal(false)} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl shadow-indigo-900/40 mb-6 active:scale-95">Keep Lifting</button>
            <button onClick={cancelWorkout} className="text-rose-500 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 active:scale-90">Yes, Discard Everything</button>
          </div>
        </div>
      )}

      {/* DELOAD MODAL */}
      {deloadAlert && (
        <div className={`fixed inset-0 z-[400] flex items-center justify-center p-6 text-center backdrop-blur-xl ${isDark ? 'bg-slate-950/90' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500 animate-bounce"><TrendingDown size={48} /></div></div>
            <h3 className={`text-2xl font-black mb-4 uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Accept Deload?</h3>
            <div className="space-y-3 mb-8">{deloadAlert.map((r, i) => <p key={i} className="text-slate-400 text-xs font-bold leading-relaxed">{r}</p>)}</div>
            <button onClick={() => { setWeights(pendingDeloadWeights); initializeSession(pendingDeloadWeights); setPendingDeloadWeights(null); setDeloadAlert(null); }} className="w-full py-5 bg-amber-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl active:scale-95">Accept & Lift</button>
          </div>
        </div>
      )}

      {/* RESTORE MODAL */}
      {showRestorePrompt && (
        <div className={`fixed inset-0 z-[300] flex items-center justify-center p-6 text-center backdrop-blur-md ${isDark ? 'bg-slate-950/90' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-6"><div className="p-4 rounded-3xl bg-indigo-500/10 text-indigo-500 animate-pulse"><AlertCircle size={48} /></div></div>
            <h3 className={`text-2xl font-black mb-2 uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Sync History?</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed mb-10">Log empty. Restore a backup to maintain progress.</p>
            <div className="space-y-12"><button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95"><Upload size={20} className="inline mr-2" /> Restore Backup</button><button onClick={() => startWorkout(true)} className="text-[10px] font-black uppercase text-slate-700 tracking-[0.3em]">Skip and start fresh</button></div>
          </div>
        </div>
      )}

      {/* PLATE CALC MODAL */}
      {showPlateCalc && (
        <div className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm ${isDark ? 'bg-slate-950/80' : 'bg-slate-500/50'}`}>
          <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <button onClick={() => setShowPlateCalc(null)} className={`absolute top-4 right-4 p-2 rounded-full ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}><X size={20} /></button>
            <div className="text-center mb-8"><h3 className={`text-3xl font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>{showPlateCalc.weight} KG</h3><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Plates Per Side (20kg Bar)</p></div>
            <div className="flex flex-wrap justify-center gap-3 mb-8">{plates.map((p, i) => (<div key={i} className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center font-black ${p>=20?'bg-indigo-600 border-indigo-500 text-white':p>=10 ? 'bg-slate-800 border-slate-700 text-white' : (isDark ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400')}`}><span className="text-[10px] opacity-50 leading-none">KG</span><span>{p}</span></div>))}</div>
            <button onClick={() => setShowPlateCalc(null)} className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'}`}>Close</button>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
    </div>
  );
};

export default App;
