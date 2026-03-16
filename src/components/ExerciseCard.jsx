import React from 'react';
import { ChevronUp, ChevronDown, Plus, Minus } from 'lucide-react';
import { calculateWarmup } from '../utils';

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
            <button onClick={() => onUpdateWeight(exIdx, -ex.increment)} aria-label={`Decrease ${ex.name} weight`} className={`p-1.5 rounded-lg border ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Minus size={12} /></button>
            <span className={`text-2xl font-black ${isDark ? 'text-indigo-400' : 'text-indigo-600'} leading-none`}>{ex.weight}kg</span>
            <button onClick={() => onUpdateWeight(exIdx, ex.increment)} aria-label={`Increase ${ex.name} weight`} className={`p-1.5 rounded-lg border ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'} active:bg-slate-800 focus:outline-none`}><Plus size={12} /></button>
          </div>
          <button onClick={() => onShowPlates(ex)} className="text-[10px] font-black block uppercase text-slate-500 mt-1">Plates</button>
        </div>
      </div>
      {expanded && (
        <div className={`mb-6 p-4 rounded-2xl ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1"><span>Empty Bar</span><span>20kg × 5</span></div>
          <div className="flex justify-between text-xs font-bold text-slate-500"><span>Working Prep</span><span>{calculateWarmup(ex.weight)}kg × 3</span></div>
        </div>
      )}
      <div className="flex justify-between gap-2 items-center">
        {ex.setsCompleted.map((r, ri) => (
          <button key={ri} onClick={() => onToggleSet(exIdx, ri)} aria-label={`Set ${ri + 1}${r !== null ? `, ${r} reps` : ''}`} className={`flex-1 aspect-square rounded-xl flex items-center justify-center border-4 transition-all touch-manipulation active:scale-90 ${r !== null ? (r === 5 ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-rose-500 border-rose-600 text-white') : (isDark ? 'bg-slate-950 border-slate-800 text-slate-800' : 'bg-white border-slate-100 text-slate-200')}`}><span className="text-xl font-black">{r !== null ? r : ri + 1}</span></button>
        ))}
        {ex.sets === 1 && <div className="flex-[3] text-center font-black uppercase text-slate-600 text-[10px] tracking-widest">1x5 Target</div>}
      </div>
    </div>
  );
});

export default ExerciseCard;
