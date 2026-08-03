import { useState, useCallback } from 'react';
import {
  normalizeMcTop, normalizeMcWeek, normalizeMcInterval, normalizeMcPress, normalizeMcNextDay, normalizeMcPending,
} from '../utils';
import { INITIAL_WEIGHTS } from '../constants';

// Groups Madcow's six pieces of program state -- normalised together, persisted
// together (App's useSyncStorage call), and hydrated together (restore/import/
// cross-tab sync all touch the same six fields in the same order). `weights` stays
// in App.jsx: switchProgram, updateMcTop and finishWorkout's Madcow branch all
// mutate mcTop and weights together, and splitting weights out here would just move
// that coupling into two files instead of removing it.
export const useMadcowState = (saved) => {
  const [mcTop, setMcTop] = useState(() => normalizeMcTop(saved.mcTop, saved.weights ?? INITIAL_WEIGHTS));
  const [mcWeek, setMcWeek] = useState(() => normalizeMcWeek(saved.mcWeek));
  const [mcInterval, setMcInterval] = useState(() => normalizeMcInterval(saved.mcInterval));
  const [mcPress, setMcPress] = useState(() => normalizeMcPress(saved.mcPress));
  const [mcNextDay, setMcNextDay] = useState(() => normalizeMcNextDay(saved.mcNextDay));
  const [mcPending, setMcPending] = useState(() => normalizeMcPending(saved.mcPending));

  // Applies a backup/sync payload -- restore, import, or the cross-tab storage
  // listener all land here. `weights` is passed in explicitly since mcTop's
  // normalizer needs a fallback and this hook doesn't own that state.
  const hydrate = useCallback((data, weights) => {
    if (data.mcTop) setMcTop(normalizeMcTop(data.mcTop, data.weights ?? weights));
    if (data.mcWeek) setMcWeek(normalizeMcWeek(data.mcWeek));
    if (data.mcInterval) setMcInterval(normalizeMcInterval(data.mcInterval));
    if (data.mcPress) setMcPress(normalizeMcPress(data.mcPress));
    if (data.mcNextDay) setMcNextDay(normalizeMcNextDay(data.mcNextDay));
    if (data.mcPending !== undefined) setMcPending(normalizeMcPending(data.mcPending));
  }, []);

  return {
    mcTop, setMcTop,
    mcWeek, setMcWeek,
    mcInterval, setMcInterval,
    mcPress, setMcPress,
    mcNextDay, setMcNextDay,
    mcPending, setMcPending,
    hydrate,
  };
};
