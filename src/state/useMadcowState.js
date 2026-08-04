import { useState, useCallback } from 'react';
import {
  normalizeMcTop, normalizeMcWeek, normalizeMcInterval, normalizeMcPress, normalizeMcNextDay, normalizeMcPending,
  normalizeMcSeeded,
} from '../utils';
import { INITIAL_WEIGHTS } from '../constants';

// Groups Madcow's seven pieces of program state -- normalised together, persisted
// together (App's useSyncStorage call), and hydrated together (`hydrate` below).
// `weights` stays in App.jsx: switchProgram, updateMcTop and finishWorkout's Madcow
// branch all mutate mcTop and weights together, and splitting weights out here would
// just move that coupling into two files instead of removing it.
export const useMadcowState = (saved) => {
  const [mcTop, setMcTop] = useState(() => normalizeMcTop(saved.mcTop, saved.weights ?? INITIAL_WEIGHTS));
  const [mcWeek, setMcWeek] = useState(() => normalizeMcWeek(saved.mcWeek));
  const [mcInterval, setMcInterval] = useState(() => normalizeMcInterval(saved.mcInterval));
  const [mcPress, setMcPress] = useState(() => normalizeMcPress(saved.mcPress));
  const [mcNextDay, setMcNextDay] = useState(() => normalizeMcNextDay(saved.mcNextDay));
  const [mcPending, setMcPending] = useState(() => normalizeMcPending(saved.mcPending));
  const [mcSeeded, setMcSeeded] = useState(() => normalizeMcSeeded(saved.mcSeeded, saved));

  // Applies a cross-tab storage sync payload (see App.jsx's useStorageSync). `weights`
  // is passed in explicitly since mcTop's normalizer needs a fallback and this hook
  // doesn't own that state.
  const hydrate = useCallback((data, weights) => {
    if (data.mcTop !== undefined) setMcTop(normalizeMcTop(data.mcTop, data.weights ?? weights));
    if (data.mcWeek !== undefined) setMcWeek(normalizeMcWeek(data.mcWeek));
    if (data.mcInterval !== undefined) setMcInterval(normalizeMcInterval(data.mcInterval));
    if (data.mcPress !== undefined) setMcPress(normalizeMcPress(data.mcPress));
    if (data.mcNextDay !== undefined) setMcNextDay(normalizeMcNextDay(data.mcNextDay));
    if (data.mcPending !== undefined) setMcPending(normalizeMcPending(data.mcPending));
    if (data.mcSeeded !== undefined) setMcSeeded(normalizeMcSeeded(data.mcSeeded, data));
  }, []);

  return {
    mcTop, setMcTop,
    mcWeek, setMcWeek,
    mcInterval, setMcInterval,
    mcPress, setMcPress,
    mcNextDay, setMcNextDay,
    mcPending, setMcPending,
    mcSeeded, setMcSeeded,
    hydrate,
  };
};
