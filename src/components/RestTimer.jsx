import React from 'react';
import { CheckCircle2, Timer, BellRing, Dumbbell } from 'lucide-react';

const RestTimer = React.memo(({ seconds, total, isDark, onSkip, isExerciseComplete, isExpired, navExpanded, elapsed }) => {
  if (seconds <= 0 && !isExerciseComplete && !isExpired) return null;
  const progress = (isExerciseComplete || isExpired) ? 100 : (seconds / total) * 100;
  const bottomOffset = navExpanded ? 'bottom-[80px]' : 'bottom-[48px]';

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className={`fixed ${bottomOffset} inset-x-0 max-w-md mx-auto z-[100] transition-all duration-300 ${isDark ? 'bg-slate-900 border-t border-slate-800' : 'bg-white border-t border-slate-200'} shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.3)]`}>
      <div className="py-4 px-6 flex justify-between items-center">
        {isExerciseComplete ? (
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest leading-none mb-1">Movement Finished</span>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-500" />
              <span className={`text-[11px] font-bold leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Setup next exercise.<br />No rest required.</span>
            </div>
          </div>
        ) : isExpired ? (
          <div className="flex flex-col">
            <span className={`text-[10px] font-black uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'} tracking-widest leading-none mb-1`}>Lifting</span>
            <div className="flex items-center gap-3">
              <Dumbbell size={24} className={isDark ? 'text-indigo-500' : 'text-indigo-600'} />
              <span className={`text-4xl font-black font-mono leading-none ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{formatTime(elapsed || 0)}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">Recovery Phase</span>
            <div className="flex items-center gap-3">
              <Timer size={24} className={isDark ? 'text-indigo-500' : 'text-indigo-600'} />
              <span className={`text-4xl font-black font-mono leading-none ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{formatTime(seconds)}</span>
            </div>
          </div>
        )}
        {isExerciseComplete ? (
          <button
            onClick={onSkip}
            aria-label="Dismiss"
            className="px-6 py-2.5 rounded-2xl font-black text-xs uppercase transition-all active:scale-95 bg-emerald-500/10 text-emerald-500"
          >
            Got it
          </button>
        ) : !isExpired ? (
          <button
            onClick={onSkip}
            aria-label="Skip rest"
            className="px-6 py-2.5 rounded-2xl font-black text-xs uppercase transition-all active:scale-95 bg-rose-500/10 text-rose-500"
          >
            Skip
          </button>
        ) : null}
      </div>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 linear ${isExerciseComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
});

export default RestTimer;
