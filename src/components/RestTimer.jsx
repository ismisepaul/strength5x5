import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkipForward } from '@phosphor-icons/react';
import { formatClock, restElapsedFromTimer, rawRestElapsedFromTimer } from '../utils';
import { useElapsedSince } from '../hooks/useElapsedSince';
import { REST_WARNING_SECONDS, CUSTOM_REST_MAX, REST_PRESETS } from '../constants';

const pct = (n, denom) => (denom > 0 ? `${Math.min(100, Math.max(0, (n / denom) * 100))}%` : '0%');

const RestTimer = React.memo(({ seconds, total, onSkip, isExerciseComplete, isExpired, isActive, elapsed, startedAt }) => {
  const { t } = useTranslation();
  // useTimer already re-renders this component every 250ms while rest is running (via
  // seconds/elapsed), so the session clock piggybacks on that same render instead of
  // polling Date.now() on its own independent interval -- two separately-scheduled
  // intervals is what let the two clocks visibly fall out of phase with each other.
  // The fallback interval is genuinely stopped while resting rather than just ignored:
  // left running it would still re-render on its own schedule, refreshing the session
  // clock against a `seconds` that useTimer hasn't ticked yet. It resyncs immediately
  // when re-enabled, so handing back to it costs nothing.
  const resting = isActive || isExpired;
  const tickingSessionElapsed = useElapsedSince(startedAt, !resting);
  const sessionElapsed = resting && startedAt ? Math.floor((Date.now() - startedAt) / 1000) : tickingSessionElapsed;

  const isWarning = isActive && seconds > 0 && seconds <= REST_WARNING_SECONDS;

  // The clock counts up from 0 and keeps running past `total` (the marker) instead of
  // resetting there -- only the hard 5:00 ceiling stops it. `total` is 0 whenever no
  // rest is pending (idle, or just after the last set of an exercise), which also hides
  // the marker/track scale below rather than pinning them to 0:00.
  const marker = Math.min(total || 0, CUSTOM_REST_MAX);
  const showMarker = marker > 0;
  const restElapsed = restElapsedFromTimer({ isActive, isExpired, duration: total, seconds, elapsed });
  const atCeiling = restElapsed >= CUSTOM_REST_MAX;
  // The digits above freeze at the 5:00 ceiling, but the overtime bracket reads off the
  // uncapped elapsed time instead, so it keeps counting up rather than freezing at
  // whatever "+m:ss" the ceiling happened to land on.
  const rawElapsed = rawRestElapsedFromTimer({ isActive, isExpired, duration: total, seconds, elapsed });
  const over = Math.max(0, rawElapsed - marker);

  // The track's scale is the interval, not a fixed 0-5:00 span, so a 1:30 rest fills
  // the line instead of leaving two-thirds of the strip permanently empty. Once overtime
  // runs past the current scale, it re-scales to the next rest preset above the marker
  // (1:30 -> 3:00 -> 5:00) rather than jumping straight to the 5:00 ceiling -- a 1:30
  // rest that runs long gets the 3:00 scale first, and only earns the full 5:00 once it
  // actually runs past 3:00 too.
  const scaleSteps = [...new Set([marker, ...REST_PRESETS])].filter(w => w >= marker).sort((a, b) => a - b);
  const denom = showMarker ? scaleSteps.find(w => restElapsed <= w) : 0;
  const markerPct = denom > 0 ? Math.min(100, (marker / denom) * 100) : 0;

  let kicker, digits, showSkip, accentState;
  if (isExerciseComplete) {
    kicker = isExerciseComplete === 'workout' ? t('timer.workoutComplete') : t('timer.movementFinished');
    digits = sessionElapsed;
    showSkip = true;
    accentState = true;
  } else {
    kicker = !resting ? t('timer.inSession')
      : atCeiling ? t('timer.time')
        : over > 0 ? t('timer.lift')
          : isWarning ? t('timer.getReady')
            : t('timer.rest');
    digits = resting ? restElapsed : sessionElapsed;
    showSkip = false;
    accentState = resting && (isWarning || over > 0 || atCeiling);
  }

  const mutedClass = 'text-ink/62';
  // The five-second warning and the 5:00 ceiling share the same "pay attention now"
  // treatment -- the ceiling's flash has no natural end the way the warning's five
  // seconds do, so it keeps breathing for as long as rest keeps running past it, which
  // is exactly the point: there should be no more rest once it's showing.
  const flashing = isWarning || atCeiling;
  const thickBar = flashing || over > 0;

  return (
    <div className={`relative flex-none pt-4 px-5 pb-3 ${flashing ? 'bg-accent-900 border-b border-accent' : 'bg-surface-deep'}`}>
      {flashing && (
        // Opacity is owned entirely by warnBreathe's keyframes (which hold a steady
        // .09 under prefers-reduced-motion), so there's no static opacity utility here
        // to be overridden by the animation.
        <div className="absolute inset-0 bg-accent animate-[warnBreathe_1s_ease-in-out_infinite] pointer-events-none" aria-hidden="true" />
      )}
      <div className="relative flex items-end justify-between">
        <div className="flex items-end gap-2">
          <div>
            <p className={`font-mono text-kicker font-bold uppercase tracking-[0.14em] mb-0.5 ${accentState ? 'text-accent-300' : mutedClass}`}>{kicker}</p>
            <p className={`font-mono font-bold tabular-nums leading-none ${flashing ? 'text-[52px]' : 'text-[44px]'} ${accentState ? 'text-accent-300' : ''}`}>{formatClock(digits * 1000)}</p>
          </div>
          {over > 0 && (
            // The main digits already read total rest elapsed -- this is the delta past
            // the marker specifically. Parenthesized rather than "over": the lifter may
            // simply still be lifting, not running late, and "over" reads as a verdict
            // the app has no way to make.
            <span className="pb-[5px] font-mono text-[12px] font-bold tabular-nums tracking-[0.02em] text-accent-300 whitespace-nowrap">
              (+{formatClock(over * 1000)})
            </span>
          )}
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
          <p className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-accent-300 mb-0.5">{t('timer.workout')}</p>
          <p className={`font-mono text-[16px] tabular-nums leading-none text-ink/60`}>{formatClock(sessionElapsed * 1000)}</p>
        </div>
      </div>

      <div className="mt-2.5">
        {/* The marker and wall rows always occupy their height, marker content or not --
            mounting/unmounting them only once a rest starts is what made the strip grow
            the instant a set was logged. showMarker instead toggles their content. */}
        <div className="relative h-3.5">
          {showMarker && (
            <>
              {/* Counting up means the target is no longer implied by the digits the way
                  a countdown's remaining time was, and the caret conveys it by position
                  alone -- so the target gets a text equivalent instead of being left
                  visual-only. The caret itself stays decorative. */}
              <span className="sr-only">{t('timer.restTargetAria', { time: formatClock(marker * 1000) })}</span>
              <div
                aria-hidden="true"
                className="absolute top-0 flex flex-col items-center gap-px text-accent-300"
                style={{ left: pct(marker, denom), transform: markerPct > 88 ? 'translateX(-100%)' : 'translateX(-50%)' }}
              >
                <span className="font-mono text-[10px] font-bold tabular-nums leading-none whitespace-nowrap">{formatClock(marker * 1000)}</span>
                <div className="w-0 h-0 border-x-[4px] border-x-transparent border-t-[5px] border-t-accent-300" />
              </div>
            </>
          )}
        </div>
        <div className={`relative w-full bg-ink/14 overflow-hidden ${thickBar ? 'h-[5px]' : 'h-[3px]'} transition-[height] duration-200`}>
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: pct(Math.min(restElapsed, marker), denom),
              background: 'linear-gradient(to right, transparent, var(--color-accent) 24px, var(--color-accent))',
              transition: 'width 1s linear',
            }}
          />
          {over > 0 && (
            // Overtime fills in the accent at low opacity, no border -- a wash rather
            // than a second solid segment, so it doesn't compete with the primary fill
            // for attention while still reading clearly against the empty track.
            <div
              className="absolute inset-y-0 bg-accent/22"
              style={{ left: pct(marker, denom), width: pct(over, denom), transition: 'left 900ms cubic-bezier(.4,0,.2,1), width 900ms cubic-bezier(.4,0,.2,1)' }}
            />
          )}
          {showMarker && (
            <>
              <div
                className="absolute inset-y-0 w-px bg-ground/50"
                style={{ left: pct(90, denom), opacity: denom > 95 && Math.abs(marker - 90) > 2 ? 1 : 0, transition: 'left 900ms cubic-bezier(.4,0,.2,1), opacity 300ms ease' }}
                aria-hidden="true"
              />
              <div
                className="absolute inset-y-0 w-px bg-ground/50"
                style={{ left: pct(180, denom), opacity: denom > 185 && Math.abs(marker - 180) > 2 ? 1 : 0, transition: 'left 900ms cubic-bezier(.4,0,.2,1), opacity 300ms ease' }}
                aria-hidden="true"
              />
            </>
          )}
        </div>
        <div className="relative h-3 mt-1.5" aria-hidden="true">
          <span
            className="absolute right-0 font-mono text-[9px] font-bold tracking-wide text-ink/38"
            style={{ opacity: showMarker && denom > marker + 2 ? 1 : 0, transition: 'opacity 400ms ease' }}
          >{formatClock(denom * 1000)}</span>
          {showMarker && (
            <>
              {/* Same reference points as the two hairline ticks above, labeled instead of
                  left as an unmarked break in the line -- same visibility rule as their
                  tick too, so a label never appears over a hidden line. */}
              <span
                className="absolute font-mono text-[9px] font-bold tracking-wide text-ink/38"
                style={{ left: pct(90, denom), transform: 'translateX(-50%)', opacity: denom > 95 && Math.abs(marker - 90) > 2 ? 1 : 0, transition: 'opacity 400ms ease' }}
              >{formatClock(90 * 1000)}</span>
              <span
                className="absolute font-mono text-[9px] font-bold tracking-wide text-ink/38"
                style={{ left: pct(180, denom), transform: 'translateX(-50%)', opacity: denom > 185 && Math.abs(marker - 180) > 2 ? 1 : 0, transition: 'opacity 400ms ease' }}
              >{formatClock(180 * 1000)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default RestTimer;
