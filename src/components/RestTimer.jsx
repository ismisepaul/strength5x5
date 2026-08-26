import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkipForward, CaretDown } from '@phosphor-icons/react';
import { formatClock } from '../utils';
import { useElapsedSince } from '../hooks/useElapsedSince';
import { REST_WARNING_SECONDS, CUSTOM_REST_MAX } from '../constants';

const pct = (seconds) => `${Math.min(100, Math.max(0, (seconds / CUSTOM_REST_MAX) * 100))}%`;

const RestTimer = React.memo(({ seconds, total, onSkip, isExerciseComplete, isExpired, isActive, elapsed, startedAt, workoutType }) => {
  const { t } = useTranslation();
  // useTimer already re-renders this component every 250ms while rest is running (via
  // seconds/elapsed), so the session clock piggybacks on that same render instead of
  // polling Date.now() on its own independent interval -- two separately-scheduled
  // intervals is what let the two clocks visibly fall out of phase with each other.
  // useElapsedSince's own 1s interval is only the fallback for when nothing else is
  // driving a re-render (idle, with no rest to borrow a tick from).
  const tickingSessionElapsed = useElapsedSince(startedAt, true);
  const resting = isActive || isExpired;
  const sessionElapsed = resting && startedAt ? Math.floor((Date.now() - startedAt) / 1000) : tickingSessionElapsed;

  const isWarning = isActive && seconds > 0 && seconds <= REST_WARNING_SECONDS;

  // The clock counts up from 0 and keeps running past `total` (the marker) instead of
  // resetting there -- only the hard 5:00 ceiling stops it. `total` is 0 whenever no
  // rest is pending (idle, or just after the last set of an exercise), which also hides
  // the marker/wall below rather than pinning them to 0:00.
  const marker = Math.min(total || 0, CUSTOM_REST_MAX);
  const showMarker = marker > 0;
  const restElapsed = Math.min(
    isActive ? Math.max(0, total - seconds) : isExpired ? total + elapsed : 0,
    CUSTOM_REST_MAX,
  );

  let kicker, digits, showSkip, accentState;
  if (isExerciseComplete) {
    kicker = isExerciseComplete === 'workout' ? t('timer.workoutComplete') : t('timer.movementFinished');
    digits = sessionElapsed;
    showSkip = true;
    accentState = true;
  } else if (isExpired) {
    kicker = t('timer.lift');
    digits = restElapsed;
    showSkip = false;
    accentState = true;
  } else if (isActive) {
    kicker = isWarning ? t('timer.getReady') : t('timer.rest');
    digits = restElapsed;
    showSkip = false;
    accentState = isWarning;
  } else {
    kicker = t('timer.inSession');
    digits = sessionElapsed;
    showSkip = false;
    accentState = false;
  }

  const mutedClass = 'text-ink/62';

  return (
    <div className={`relative flex-none pt-4 px-5 pb-3 ${isWarning ? 'bg-accent-900 border-b border-accent' : 'bg-surface-deep'}`}>
      {isWarning && (
        // Opacity is owned entirely by warnBreathe's keyframes (which hold a steady
        // .09 under prefers-reduced-motion), so there's no static opacity utility here
        // to be overridden by the animation.
        <div className="absolute inset-0 bg-accent animate-[warnBreathe_1s_ease-in-out_infinite] pointer-events-none" aria-hidden="true" />
      )}
      <div className="relative flex items-end justify-between">
        <div className="flex items-end gap-2">
          <div>
            <p className={`font-mono text-kicker font-bold uppercase tracking-[0.14em] mb-0.5 ${accentState ? 'text-accent-300' : mutedClass}`}>{kicker}</p>
            <p className={`font-mono font-bold tabular-nums leading-none ${isWarning ? 'text-[52px]' : 'text-[44px]'} ${accentState ? 'text-accent-300' : ''}`}>{formatClock(digits * 1000)}</p>
          </div>
          {showSkip && (
            // showSkip is only ever true for the exercise/workout-complete banners --
            // rest itself has no controls (see the derivation above) -- so this is
            // always a dismiss, never a mid-rest skip.
            <button
              onClick={onSkip}
              aria-label="Dismiss"
              className={`w-[34px] h-[34px] rounded-[7px] border flex items-center justify-center shrink-0 border-ink/26`}
            ><SkipForward size={14} weight="fill" /></button>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-accent-300 mb-0.5">{t(`workout.type${workoutType}`)}</p>
          <p className={`font-mono text-[16px] tabular-nums leading-none text-ink/60`}>{formatClock(sessionElapsed * 1000)}</p>
        </div>
      </div>

      <div className="mt-2.5">
        {/* The marker and wall rows always occupy their height, marker content or not --
            mounting/unmounting them only once a rest starts is what made the strip grow
            the instant a set was logged. showMarker instead toggles their content. */}
        <div className="relative h-3.5" aria-hidden="true">
          {showMarker && (
            <>
              {/* Unlabeled reference tick at 1:30 (light-rest recovery point) so the
                  hairline on the track below reads as a specific mark, not a stray line. */}
              <div className="absolute bottom-0 text-ink/40" style={{ left: '30%', transform: 'translateX(-50%)' }}>
                <CaretDown size={7} weight="bold" />
              </div>
              <div
                className="absolute top-0 flex flex-col items-center gap-px text-accent-300"
                style={{ left: pct(marker), transform: 'translateX(-50%)' }}
              >
                <span className="font-mono text-[10px] font-bold tabular-nums leading-none whitespace-nowrap">{formatClock(marker * 1000)}</span>
                <CaretDown size={7} weight="bold" />
              </div>
            </>
          )}
        </div>
        <div className={`relative w-full bg-ink/14 overflow-hidden ${isWarning ? 'h-[5px]' : 'h-[3px]'}`}>
          <div
            className="h-full"
            style={{
              width: pct(restElapsed),
              background: 'linear-gradient(to right, transparent, var(--color-accent) 24px, var(--color-accent))',
              transition: 'width 1s linear',
            }}
          />
          {showMarker && (
            <>
              <div className="absolute inset-y-0 w-px bg-ground/50" style={{ left: '30%' }} aria-hidden="true" />
              <div className="absolute inset-y-0 w-px bg-ground/50" style={{ left: '60%' }} aria-hidden="true" />
            </>
          )}
        </div>
        <div className="relative h-3 mt-1.5" aria-hidden="true">
          <span
            className="absolute right-0 font-mono text-[9px] font-bold tracking-wide text-ink/38"
            style={{ opacity: showMarker && marker < CUSTOM_REST_MAX ? 1 : 0 }}
          >{formatClock(CUSTOM_REST_MAX * 1000)}</span>
        </div>
        {isWarning && (
          <div className="mt-2.5 flex items-center gap-[7px]" aria-hidden="true">
            {[5, 4, 3, 2, 1].map((n) => (
              <span
                key={n}
                className={`w-2 h-2 rounded-full ${seconds <= n ? 'bg-accent border border-accent' : 'border border-accent/30'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default RestTimer;
