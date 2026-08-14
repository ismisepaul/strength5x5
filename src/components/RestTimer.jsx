import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkipForward } from '@phosphor-icons/react';
import { formatClock } from '../utils';
import { useElapsedSince } from '../hooks/useElapsedSince';
import { REST_WARNING_SECONDS } from '../constants';

const RestTimer = React.memo(({ seconds, total, onSkip, isExerciseComplete, isExpired, isActive, elapsed, startedAt, workoutType }) => {
  const { t } = useTranslation();
  const sessionElapsed = useElapsedSince(startedAt, true);

  const isWarning = isActive && seconds > 0 && seconds <= REST_WARNING_SECONDS;

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
    kicker = isWarning ? t('timer.getReady') : t('timer.rest');
    digits = seconds;
    showSkip = true;
    accentState = isWarning;
    progress = total > 0 ? (1 - seconds / total) * 100 : 0;
  } else {
    kicker = t('timer.inSession');
    digits = sessionElapsed;
    showSkip = false;
    accentState = false;
    progress = 0;
  }

  const mutedClass = 'text-ink/62';

  return (
    <div className={`relative flex-none pt-4 px-5 pb-3 ${isWarning ? 'bg-accent-900 border-b border-accent' : 'bg-surface-deep'}`}>
      {isWarning && (
        <div className="absolute inset-0 bg-accent opacity-[.09] animate-[warnBreathe_1s_ease-in-out_infinite] pointer-events-none" aria-hidden="true" />
      )}
      <div className="relative flex items-end justify-between">
        <div className="flex items-end gap-2">
          <div>
            <p className={`font-mono text-kicker font-bold uppercase tracking-[0.14em] mb-0.5 ${accentState ? 'text-accent-300' : mutedClass}`}>{kicker}</p>
            <p className={`font-mono font-bold tabular-nums leading-none ${isWarning ? 'text-[52px]' : 'text-[44px]'} ${accentState ? 'text-accent-300' : ''}`}>{formatClock(digits * 1000)}</p>
          </div>
          {showSkip && (
            <button
              onClick={onSkip}
              aria-label={isExerciseComplete ? 'Dismiss' : 'Skip rest'}
              className={`w-[34px] h-[34px] rounded-[7px] border flex items-center justify-center shrink-0 border-ink/26`}
            ><SkipForward size={14} weight="fill" /></button>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-accent-300 mb-0.5">{t(`workout.type${workoutType}`)}</p>
          <p className={`font-mono text-[16px] tabular-nums leading-none text-ink/60`}>{formatClock(sessionElapsed * 1000)}</p>
        </div>
      </div>
      <div className={`relative w-full mt-2.5 bg-ink/14 overflow-hidden ${isWarning ? 'h-[5px]' : 'h-[3px]'}`}>
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(to right, transparent, var(--color-accent) 24px, var(--color-accent))',
            transition: 'width 1s linear',
          }}
        />
      </div>
    </div>
  );
});

export default RestTimer;
