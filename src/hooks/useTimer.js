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
  // running. Not memoized (it closes over this render's seconds/elapsed/duration
  // directly) since it's only ever called from an event handler, never used as another
  // hook's dependency. A no-op when nothing is currently counting; that case only
  // affects the *next* rest, which reads the new duration fresh when it starts.
  const retarget = (newDuration) => {
    if (!isActive && !isExpired) return;
    const totalElapsed = isActive ? Math.max(0, duration - seconds) : duration + elapsed;
    if (newDuration > totalElapsed) {
      const nextSeconds = newDuration - totalElapsed;
      endTimeRef.current = Date.now() + nextSeconds * 1000;
      expiredAtRef.current = null;
      setSeconds(nextSeconds);
      setDuration(newDuration);
      setElapsed(0);
      setIsActive(true);
      setIsExpired(false);
    } else {
      const nextElapsed = totalElapsed - newDuration;
      expiredAtRef.current = Date.now() - nextElapsed * 1000;
      endTimeRef.current = null;
      setSeconds(0);
      setDuration(newDuration);
      setElapsed(nextElapsed);
      setIsActive(false);
      setIsExpired(true);
    }
  };

  return { seconds, duration, isActive, isExpired, elapsed, start, stop, resume, reset, retarget };
}
