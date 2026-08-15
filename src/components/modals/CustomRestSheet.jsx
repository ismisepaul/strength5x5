import React from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus } from '@phosphor-icons/react';
import StepperButton from '../StepperButton';
import { formatClock } from '../../utils';
import { CUSTOM_REST_MIN, CUSTOM_REST_MAX, CUSTOM_REST_STEP, CUSTOM_REST_SHORTCUTS } from '../../constants';
import Sheet from './Sheet';
import { Z_TOP } from './zIndex';

// Design 3b: "the list never moves." Unlike WeightInput's inline stepper/typed-number
// lockup, this sheet has no text input -- it's reached from Options where a keyboard
// isn't the point, so precision comes from four shortcut chips (the intervals people
// actually reach for) plus a coarse +/-5s trim, not typing. Steppers commit straight to
// preferredRest, same as every other stepper in the app -- there's no local draft to
// revert, so Done is a plain dismiss.
const CustomRestSheet = ({ preferredRest, setPreferredRest, onClose }) => {
  const { t } = useTranslation();
  const clamp = (n) => Math.min(CUSTOM_REST_MAX, Math.max(CUSTOM_REST_MIN, n));
  const step = (diff) => setPreferredRest(clamp(preferredRest + diff));

  return (
    <Sheet ariaLabel={t('options.restIntervalCustomSheetTitle')} z={Z_TOP} onClose={onClose}>
      <p className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-accent-300 mb-0.5">
        {t('options.restIntervalCustomSheetTitle')}
      </p>
      <p className="text-meta text-ink/55 mb-[18px]">
        {t('options.restIntervalCustomSheetDesc', {
          min: CUSTOM_REST_MIN, maxMinutes: CUSTOM_REST_MAX / 60, step: CUSTOM_REST_STEP,
        })}
      </p>

      <div className="flex items-center justify-center gap-5 mb-5">
        <StepperButton
          onClick={() => step(-CUSTOM_REST_STEP)}
          ariaLabel={t('options.restIntervalDecreaseAria')}
          icon={Minus}
          size={52}
          iconSize={18}
        />
        <span className="font-mono text-[44px] font-bold tabular-nums leading-none text-accent-300">
          {formatClock(preferredRest * 1000)}
        </span>
        <StepperButton
          onClick={() => step(CUSTOM_REST_STEP)}
          ariaLabel={t('options.restIntervalIncreaseAria')}
          icon={Plus}
          size={52}
          iconSize={18}
        />
      </div>

      <div className="flex gap-2 mb-[18px]">
        {CUSTOM_REST_SHORTCUTS.map((secs) => (
          <button
            key={secs}
            onClick={() => setPreferredRest(secs)}
            className={`flex-1 h-[38px] rounded-lg border font-mono text-[13px] tabular-nums ${
              preferredRest === secs ? 'border-accent bg-accent-900 text-accent-300' : 'border-ink/18 text-ink/62'
            }`}
          >{formatClock(secs * 1000)}</button>
        ))}
      </div>

      <button
        onClick={onClose}
        className="w-full h-[48px] flex items-center justify-center rounded-[10px] border border-accent text-accent-300 font-medium active:scale-95"
      >{t('modals.done')}</button>
    </Sheet>
  );
};

export default CustomRestSheet;
