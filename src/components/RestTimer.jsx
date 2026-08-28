import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkipForward, Hourglass, HourglassLow, Barbell } from '@phosphor-icons/react';
import { formatClock, restElapsedFromTimer, rawRestElapsedFromTimer } from '../utils';
import { useElapsedSince } from '../hooks/useElapsedSince';
import { REST_WARNING_SECONDS, CUSTOM_REST_MAX, REST_CEILING_SETTLE_SECONDS, REST_PRESETS } from '../constants';

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
  // The ceiling's flood has no natural end the way the five-second warning does -- rest
  // itself has no controls, so left alone it would keep breathing at whoever racked the
  // bar to talk to a training partner. Once the ceiling has held for this long, the wash
  // fades out; the solid bar, accent digits and "Lift" kicker stand on their own as the
  // settled state, which is still exactly what changed.
  const ceilingSettled = atCeiling && rawElapsed >= CUSTOM_REST_MAX + REST_CEILING_SETTLE_SECONDS;

  // The track's scale is the interval, not a fixed 0-5:00 span, so a 1:30 rest fills
  // the line instead of leaving two-thirds of the strip permanently empty. Once overtime
  // runs past the current scale, it re-scales to the next rest preset above the marker
  // (1:30 -> 3:00 -> 5:00) rather than jumping straight to the 5:00 ceiling -- a 1:30
  // rest that runs long gets the 3:00 scale first, and only earns the full 5:00 once it
  // actually runs past 3:00 too.
  const scaleSteps = [...new Set([marker, ...REST_PRESETS])].filter(w => w >= marker).sort((a, b) => a - b);
  const denom = showMarker ? scaleSteps.find(w => restElapsed <= w) : 0;
  const markerPct = denom > 0 ? Math.min(100, (marker / denom) * 100) : 0;

  let kicker, digits, showSkip, accentState, StateIcon;
  if (isExerciseComplete) {
    kicker = isExerciseComplete === 'workout' ? t('timer.workoutComplete') : t('timer.movementFinished');
    digits = sessionElapsed;
    showSkip = true;
    accentState = true;
  } else {
    // Three silhouettes, three rest states, nothing that moves -- the glyph itself is
    // the signal once the ceiling wash has settled and nothing else on the strip is
    // animating. It only appears while rest is actually running: "In workout" and the
    // two completion banners above stay glyph-less, so its mere presence already means
    // "resting" and the vocabulary never has to grow past these three.
    //
    // Gated on `isExpired`, not `over > 0`: useTimer batches the expiry transition
    // (isActive -> false, isExpired -> true, elapsed reset to 0) into a single render,
    // and elapsed's own tracking effect only increments once a full second has passed
    // -- so `over` (which reads off elapsed) is still exactly 0 on that first expired
    // render. `over > 0` used to gate "Lift" here, and isWarning is false too by then
    // (it requires isActive, which just went false), so the kicker fell through to
    // "Rest" for up to a second before `over` ticked up -- a Rest/Get ready/Rest/Lift
    // flicker right at the transition. `isExpired` alone is correct: once expired,
    // we're always in the Lift phase, whether or not any overtime has accumulated yet.
    StateIcon = !resting ? null
      : isExpired ? Barbell
        : isWarning ? HourglassLow
          : Hourglass;
    kicker = !resting ? t('timer.inSession')
      : isExpired ? t('timer.lift')
        : isWarning ? t('timer.getReady')
          : t('timer.rest');
    digits = resting ? restElapsed : sessionElapsed;
    showSkip = false;
    accentState = resting && (isWarning || isExpired || atCeiling);
  }

  const mutedClass = 'text-ink/62';
  // The five-second warning and the 5:00 ceiling share the same "pay attention now"
  // treatment, but the ceiling's settles down after REST_CEILING_SETTLE_SECONDS -- see
  // ceilingSettled above. `emphasis` is the big-digit/thick-bar state, which holds for
  // as long as the ceiling does; `alarm` is just the wash's own visibility, which is
  // what actually fades. Keeping the size/weight change on `emphasis` rather than
  // `alarm` means the fade never triggers a second reflow on top of the one it's
  // replacing -- the digits and bar are already at their "pay attention" size when the
  // wash starts to fade, and stay there.
  const emphasis = isWarning || atCeiling;
  const alarm = isWarning || (atCeiling && !ceilingSettled);
  // Same isExpired-not-over>0 reasoning as the kicker above: the bar should thicken the
  // instant the Lift phase starts, not wait for `over` to tick past zero.
  const thickBar = emphasis || isExpired;

  return (
    <div className="relative flex-none pt-4 px-5 pb-3 bg-surface-deep">
      {emphasis && (
        // Mounted for as long as `emphasis` holds (so opacity has something to
        // transition from/to across the fade), with `alarm` driving the visible state.
        // The five-second warning snaps on/off as before (transition: none); only the
        // settling ceiling gets the slow fade -- a blanket transition would ramp the
        // five-second warning in over half its own window.
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: alarm ? 1 : 0, transition: ceilingSettled ? 'opacity 2600ms ease' : 'none' }}
        >
          <div className="absolute inset-0 bg-accent-900" />
          {/* Opacity here is owned entirely by warnBreathe's keyframes (which hold a
              steady .09 under prefers-reduced-motion) -- the parent's own opacity
              transition above multiplies with it rather than replacing it. */}
          <div className="absolute inset-0 bg-accent animate-[warnBreathe_1s_ease-in-out_infinite]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-accent" />
        </div>
      )}
      <div className="relative flex items-end justify-between">
        <div className="flex items-end gap-2">
          <div>
            <p className={`flex items-center gap-1.5 font-mono text-kicker font-bold uppercase tracking-[0.14em] mb-0.5 ${accentState ? 'text-accent-300' : mutedClass}`}>
              {StateIcon && <span data-state-icon><StateIcon size={13} weight="fill" aria-hidden="true" /></span>}
              {kicker}
            </p>
            <p className={`font-mono font-bold tabular-nums leading-none ${emphasis ? 'text-[52px]' : 'text-[44px]'} ${accentState ? 'text-accent-300' : ''}`}>{formatClock(digits * 1000)}</p>
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
              aria-label={t('timer.dismiss')}
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
            // Overtime fills close to the primary fill's own accent -- close enough to
            // read as part of the same bar rather than a faint wash, but the exact match
            // is saved for the ceiling itself: once atCeiling, the whole bar reads as one
            // solid, unmistakably full block, since there really should be no more rest.
            <div
              className={`absolute inset-y-0 ${atCeiling ? 'bg-accent' : 'bg-accent/70'}`}
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
