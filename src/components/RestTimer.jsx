import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkipForward } from '@phosphor-icons/react';
import { formatClock } from '../utils';
import { useElapsedSince } from '../hooks/useElapsedSince';

const RestTimer = React.memo(({ seconds, total, isDark, onSkip, isExerciseComplete, isExpired, isActive, elapsed, startedAt, workoutType }) => {
  const { t } = useTranslation();
  const sessionElapsed = useElapsedSince(startedAt, true);

  let kicker, digits, showSkip, accentState, progress;
  if (isExerciseComplete) {
    kicker = isExerciseComplete === 'workout' ? t('timer.workoutComplete') : t('timer.movementFinished');
    digits = sessionElapsed;
    showSkip = true;
    accentState = true;
    progress = 100;
  } else if (isExpired) {
    kicker = t('timer.lifting');
    digits = elapsed || 0;
    showSkip = true;
    accentState = true;
    progress = 100;
  } else if (isActive) {
    kicker = t('timer.rest');
    digits = seconds;
    showSkip = true;
    accentState = false;
    progress = total > 0 ? (1 - seconds / total) * 100 : 0;
  } else {
    kicker = t('timer.inSession');
    digits = sessionElapsed;
    showSkip = false;
    accentState = false;
    progress = 0;
  }

  const mutedClass = isDark ? 'text-ink/45' : 'text-ink-lt/45';

  return (
    <div className={`flex-none pt-3 px-5 pb-2.5 ${isDark ? 'bg-surface-deep' : 'bg-surface-deep-lt'}`}>
      <div className="flex items-end justify-between">
        <div className="flex items-end gap-2">
          <div>
            <p className={`text-[10.5px] font-semibold uppercase tracking-[0.14em] mb-0.5 ${accentState ? 'text-accent' : mutedClass}`}>{kicker}</p>
            <p className={`text-[30px] font-medium tabular-nums leading-none ${accentState ? 'text-accent' : ''}`}>{formatClock(digits * 1000)}</p>
          </div>
          {showSkip && (
            <button
              onClick={onSkip}
              aria-label={isExerciseComplete ? 'Dismiss' : 'Skip rest'}
              className={`w-[34px] h-[34px] rounded-[7px] border flex items-center justify-center shrink-0 ${isDark ? 'border-ink/18' : 'border-ink-lt/18'}`}
            ><SkipForward size={14} weight="fill" /></button>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent mb-0.5">{t(`workout.type${workoutType}`)}</p>
          <p className={`text-[16px] tabular-nums leading-none ${isDark ? 'text-ink/60' : 'text-ink-lt/60'}`}>{formatClock(sessionElapsed * 1000)}</p>
        </div>
      </div>
      <div className={`h-0.5 w-full mt-2.5 ${isDark ? 'bg-ink/8' : 'bg-ink-lt/8'} overflow-hidden`}>
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(to right, transparent, #9184d9 24px, #9184d9)',
            transition: 'width 1s linear',
          }}
        />
      </div>
    </div>
  );
});

export default RestTimer;
