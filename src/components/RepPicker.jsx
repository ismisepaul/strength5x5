import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '@phosphor-icons/react';
import { targetReps } from '../utils';

const RepPicker = ({ ex, setIdx, isDark, onSelect, onClose }) => {
  const { t } = useTranslation();
  const target = targetReps(ex);
  const options = Array.from({ length: target + 1 }, (_, i) => target - i);

  return (
    <div role="dialog" aria-modal="true" aria-label="Rep picker" className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm ${isDark ? 'bg-slate-950/80' : 'bg-slate-500/50'}`}>
      <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <button onClick={onClose} aria-label="Close rep picker" className={`absolute top-4 right-4 p-2 rounded-full ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}><X size={20} /></button>
        <div className="text-center mb-8">
          <h3 className={`text-xl font-black uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('exercises.' + ex.id)}</h3>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">{t('modals.repPickerSet', { set: setIdx + 1 })}</p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {options.map(r => (
            <button
              key={r}
              onClick={() => onSelect(r)}
              aria-label={`${r} reps`}
              className={`aspect-square rounded-2xl flex items-center justify-center font-black text-lg active:scale-90 transition-transform ${r === target ? 'bg-indigo-600 text-white' : r > 0 ? 'bg-rose-500/10 text-rose-500' : (isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}`}
            >{r}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RepPicker;
