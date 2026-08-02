import React from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, Check, X } from '@phosphor-icons/react';
import StepperButton from './StepperButton';

const WeightEditBar = ({ value, onChange, onDecrement, onIncrement, onCommit, onCancel, isDark, variant = 'row', exerciseName }) => {
  const { t } = useTranslation();
  const bgClass = variant === 'card'
    ? (isDark ? 'bg-ground/60' : 'bg-ground-lt/60')
    : (isDark ? 'bg-surface/70' : 'bg-surface-lt/70');
  const mutedClass = isDark ? 'text-ink/45' : 'text-ink-lt/45';

  return (
    <div className={`mt-2 rounded-[9px] py-3 px-2.5 flex flex-col gap-3 ${bgClass}`}>
      <div className="flex items-center justify-around">
        <StepperButton onClick={onDecrement} ariaLabel={`Decrease ${exerciseName} weight`} icon={Minus} isDark={isDark} size={44} iconSize={15} />
        <div className="flex items-baseline gap-1">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-[76px] text-center text-[22px] font-medium tabular-nums text-accent-300 bg-transparent border-0 border-b-[1.5px] border-accent focus:outline-none"
          />
          <span className={`text-[13px] ${mutedClass}`}>kg</span>
        </div>
        <StepperButton onClick={onIncrement} ariaLabel={`Increase ${exerciseName} weight`} icon={Plus} isDark={isDark} size={44} iconSize={15} />
      </div>
      <div className="flex gap-4">
        <button
          onClick={onCommit}
          aria-label={t('workout.doneEditingWeight')}
          className="flex-1 h-11 rounded-lg border border-accent text-accent-300 flex items-center justify-center active:scale-95"
        ><Check size={17} weight="bold" /></button>
        <button
          onClick={onCancel}
          aria-label={t('workout.cancelEditWeight')}
          className={`flex-1 h-11 rounded-lg border flex items-center justify-center active:scale-95 ${isDark ? 'border-ink/15 text-ink/50' : 'border-ink-lt/15 text-ink-lt/50'}`}
        ><X size={16} /></button>
      </div>
    </div>
  );
};

export default WeightEditBar;
