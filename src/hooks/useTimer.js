import { useState, useRef, useCallback, useEffect } from 'react';

export function useTimer({ onExpire } = {}) {
  const [seconds, setSeconds] = useState(0);
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

  const start = useCallback((duration) => {
    endTimeRef.current = Date.now() + duration * 1000;
    expiredAtRef.current = null;
    setSeconds(duration);
    setElapsed(0);
    setIsActive(true);
    setIsExpired(false);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    setSeconds(0);
    setElapsed(0);
    endTimeRef.current = null;
    expiredAtRef.current = null;
  }, []);

  const skip = useCallback(() => {
    endTimeRef.current = null;
    expiredAtRef.current = Date.now();
    setIsActive(false);
    setSeconds(0);
    setElapsed(0);
    setIsExpired(true);
  }, []);

  const reset = useCallback(() => {
    setIsActive(false);
    setSeconds(0);
    setElapsed(0);
    setIsExpired(false);
    endTimeRef.current = null;
    expiredAtRef.current = null;
  }, []);

  return { seconds, isActive, isExpired, elapsed, start, stop, skip, reset };
}
