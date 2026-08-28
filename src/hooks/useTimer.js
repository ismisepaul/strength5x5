import { useState, useRef, useCallback, useEffect } from 'react';

export function useTimer({ onExpire } = {}) {
  const [seconds, setSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const endTimeRef = useRef(null);
  const expiredAtRef = useRef(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        endTimeRef.current = null;
        expiredAtRef.current = Date.now();
        setIsActive(false);
        setIsExpired(true);
        setElapsed(0);
        onExpireRef.current?.();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!isExpired) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - expiredAtRef.current) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [isExpired]);

  const start = useCallback((newDuration) => {
    endTimeRef.current = Date.now() + newDuration * 1000;
    expiredAtRef.current = null;
    setSeconds(newDuration);
    setDuration(newDuration);
    setElapsed(0);
    setIsActive(true);
    setIsExpired(false);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    setSeconds(0);
    setDuration(0);
    setElapsed(0);
    endTimeRef.current = null;
    expiredAtRef.current = null;
  }, []);

  // Restores a rest that was still in flight when the app was closed. `endsAt` is when
  // that rest was due to reach its marker, which may already be in the past: unlike
  // start(), this keeps the original duration (so the marker stays where it was) and
  // hydrates any overtime that accrued while the app was shut rather than restarting
  // the count-up from zero. Never fires onExpire -- the marker was passed offline, so
  // there is no moment to chime for.
  const resume = useCallback((newDuration, endsAt) => {
    setDuration(newDuration);
    if (endsAt > Date.now()) {
      endTimeRef.current = endsAt;
      expiredAtRef.current = null;
      setSeconds(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
      setElapsed(0);
      setIsActive(true);
      setIsExpired(false);
    } else {
      endTimeRef.current = null;
      expiredAtRef.current = endsAt;
      setSeconds(0);
      setElapsed(Math.max(0, Math.floor((Date.now() - endsAt) / 1000)));
      setIsActive(false);
      setIsExpired(true);
    }
  }, []);

  const reset = useCallback(() => {
    setIsActive(false);
    setSeconds(0);
    setDuration(0);
    setElapsed(0);
    setIsExpired(false);
    endTimeRef.current = null;
    expiredAtRef.current = null;
  }, []);

  // Re-aims an in-flight rest at a new duration without resetting how much of it has
  // already elapsed -- e.g. the rest interval changes in Settings while a rest is
  // running. Not memoized (it closes over this render's duration and phase directly)
  // since it's only ever called from an event handler, never used as another hook's
  // dependency. A no-op when nothing is currently counting; that case only
  // affects the *next* rest, which reads the new duration fresh when it starts.
  const retarget = (newDuration) => {
    if (!isActive && !isExpired) return;
    const now = Date.now();
    // Elapsed time is read off the wall-clock refs, not off the integer seconds/elapsed
    // display state, because this fires on every pointer move of the Settings drag --
    // far faster than those integers tick. Deriving from them would keep recovering the
    // same whole second while re-anchoring the countdown to `now`, so a drag held for a
    // few seconds would silently give those seconds of rest back. One Date.now()
    // snapshot per call keeps the real elapsed time intact however often it's called.
    const elapsedMs = endTimeRef.current != null
      ? Math.max(0, duration * 1000 - (endTimeRef.current - now))
      : expiredAtRef.current != null
        ? duration * 1000 + Math.max(0, now - expiredAtRef.current)
        : (duration + elapsed) * 1000;
    const targetMs = newDuration * 1000;
    if (targetMs > elapsedMs) {
      const remainingMs = targetMs - elapsedMs;
      endTimeRef.current = now + remainingMs;
      expiredAtRef.current = null;
      // Same ceil the countdown interval uses, so the digits don't jump by a second the
      // moment the interval takes the value back over.
      setSeconds(Math.ceil(remainingMs / 1000));
      setDuration(newDuration);
      setElapsed(0);
      setIsActive(true);
      setIsExpired(false);
    } else {
      const overMs = elapsedMs - targetMs;
      expiredAtRef.current = now - overMs;
      endTimeRef.current = null;
      setSeconds(0);
      setDuration(newDuration);
      setElapsed(Math.floor(overMs / 1000));
      setIsActive(false);
      setIsExpired(true);
    }
  };

  return { seconds, duration, isActive, isExpired, elapsed, start, stop, resume, reset, retarget };
}
