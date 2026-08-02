import { useState, useEffect } from 'react';

export function useElapsedSince(startedAt, isRunning) {
  const [seconds, setSeconds] = useState(() => (
    startedAt && isRunning ? Math.floor((Date.now() - startedAt) / 1000) : 0
  ));

  useEffect(() => {
    if (!startedAt || !isRunning) return;
    setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, isRunning]);

  return seconds;
}
