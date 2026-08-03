import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus } from '@phosphor-icons/react';
import StepperButton from './StepperButton';
import { roundWeight } from '../utils';

// One weight control for the whole app: steppers are always tappable, the number
// is always typeable. Draft state is local to each instance, so several of these
// can be open on screen at once without stomping on each other.
const VARIANTS = {
  prominent: { size: 44, iconSize: 15, valueClass: 'text-[19px]', width: 'w-[60px]' },
  compact: { size: 40, iconSize: 16, valueClass: 'text-[16px]', width: 'w-14' },
};

export const parseWeightInput = (str) => {
  const n = parseFloat(String(str).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const WeightInput = ({ value, increment = 2.5, min = 0, onChange, label, isDark, variant = 'prominent', topSet = false }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(null); // null while not editing; typed string while editing
  const cancelingRef = useRef(false);
  const { size, iconSize, valueClass, width } = VARIANTS[variant];
  const mutedClass = isDark ? 'text-ink/45' : 'text-ink-lt/45';
  const displayValue = draft !== null ? draft : String(value);
  // A Madcow top set is never the day's flat working weight, so it gets its own aria
  // wording everywhere -- and, in the prominent (headline-number) variant, a visible
  // caption too, since Workout C's header number is the top set, not the day's
  // heavier triple attempt shown under the sets below (see design-system.md §4).
  const decreaseAriaKey = topSet ? 'workout.decreaseTopSetAria' : 'workout.decreaseWeightAria';
  const increaseAriaKey = topSet ? 'workout.increaseTopSetAria' : 'workout.increaseWeightAria';
  const inputAriaKey = topSet ? 'workout.topSetInputAria' : 'workout.weightInputAria';

  const commit = (str) => {
    const parsed = parseWeightInput(str);
    const next = parsed !== null ? roundWeight(parsed, increment, min) : value;
    if (next !== value) onChange(next);
    setDraft(null);
  };

  // Steps from whatever's currently typed (if it parses), otherwise from the
  // committed value -- so typing then tapping + adjusts the typed number, and
  // always snaps back to the grid the same way commit() does.
  const step = (diff) => {
    const parsed = draft !== null ? parseWeightInput(draft) : null;
    const base = parsed !== null ? parsed : value;
    onChange(roundWeight(base + diff, increment, min));
    setDraft(null);
  };

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      {topSet && variant === 'prominent' && (
        <span className={`text-[10.5px] ${mutedClass}`}>{t('workout.topSetFieldLabel')}</span>
      )}
      <div className="flex items-center gap-2">
        <StepperButton
          onClick={() => step(-increment)}
          onMouseDown={(e) => e.preventDefault()}
          ariaLabel={t(decreaseAriaKey, { name: label })}
          icon={Minus}
          isDark={isDark}
          size={size}
          iconSize={iconSize}
        />
        <div className="flex items-baseline gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={displayValue}
            onFocus={(e) => { setDraft(String(value)); e.target.select(); }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => {
              if (cancelingRef.current) { cancelingRef.current = false; setDraft(null); return; }
              commit(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                cancelingRef.current = true;
                e.currentTarget.blur();
              }
            }}
            aria-label={t(inputAriaKey, { name: label })}
            className={`${width} text-center ${valueClass} font-medium tabular-nums text-accent-300 bg-transparent border-0 border-b-[1.5px] ${isDark ? 'border-ink/18' : 'border-ink-lt/18'} focus:border-accent focus:outline-none`}
          />
          <span className={`text-[13px] ${mutedClass}`}>kg</span>
        </div>
        <StepperButton
          onClick={() => step(increment)}
          onMouseDown={(e) => e.preventDefault()}
          ariaLabel={t(increaseAriaKey, { name: label })}
          icon={Plus}
          isDark={isDark}
          size={size}
          iconSize={iconSize}
        />
      </div>
    </div>
  );
};

export default WeightInput;
