// The single place the active program changes. Keeps `weights` (Standard's working
// weights) and Madcow's `mcTop`/`mcWeek`/`mcNextDay`/`mcPending` from being overwritten
// by each other -- App.jsx's switchProgram used to seed/copy between them directly,
// which meant a there-and-back switch permanently lost weight (see mergeMadcowGains).
import { seedMadcowTops, seedInclineWeight } from './utils';

// A lift returning from Madcow keeps whichever is heavier: the Standard weight it had
// before the block, or the top set it reached on Madcow. That makes a quick
// there-and-back switch lossless -- the on-ramp back-off (seedMadcowTops) is always
// lighter than the Standard weight it was seeded from -- while real Madcow progress
// still carries over. Overhead press only merges when Madcow actually trained it
// (mcPress === 'press'); with the default incline, press was never touched and must
// come back untouched.
export function mergeMadcowGains(weights, mcTop, mcPress) {
  const incline = weights.incline ?? seedInclineWeight(weights.bench);
  return {
    ...weights,
    squat: Math.max(weights.squat, mcTop.squat),
    bench: Math.max(weights.bench, mcTop.bench),
    row: Math.max(weights.row, mcTop.row),
    deadlift: Math.max(weights.deadlift, mcTop.deadlift),
    press: mcPress === 'press' ? Math.max(weights.press, mcTop.press) : weights.press,
    incline: Math.max(incline, mcTop.incline),
  };
}

// Computes the next slice of program state for a switch to `target`. Never mutates
// `weights` on the way into Madcow (it stays Standard's, untouched, for the block's
// duration), and never re-seeds a Madcow block that's already been started -- `mcSeeded`
// tracks that so returning to Madcow resumes the saved top sets and week instead of
// restarting the on-ramp.
export function switchProgramState({ target, weights, mcTop, mcWeek, mcNextDay, mcPending, mcPress, mcSeeded }) {
  if (target === 'madcow') {
    if (mcSeeded) {
      // Resume: nothing changes, including `weights` -- Standard's weights sit
      // untouched until (if ever) the user switches back.
      return { weights, mcTop, mcWeek, mcNextDay, mcPending, mcSeeded };
    }
    return {
      weights,
      mcTop: seedMadcowTops(weights),
      mcWeek: 1,
      mcNextDay: 'A',
      mcPending: [],
      mcSeeded: true,
    };
  }

  // -> Standard: merge Madcow's gains into `weights`; leave mcTop/mcWeek/etc alone so
  // a future switch back to Madcow resumes exactly where this block left off.
  return {
    weights: mergeMadcowGains(weights, mcTop, mcPress),
    mcTop, mcWeek, mcNextDay, mcPending, mcSeeded,
  };
}
