// The program registry -- the single place that knows what programs exist and how each
// one turns a day letter into exercises. Every tab (Train, Program, Log, Stats) reads
// this instead of branching on `preset === 'madcow'` itself, so adding a third program
// is one entry here rather than a hunt through App.jsx.
//
// The shape is declarative data, but two fields (`liftIds`/`dayExercises`) are adapter
// functions rather than plain values -- Madcow's per-set weights are *computed* (ramp
// math in utils.js), so a data-only registry can't express them. Both adapters take the
// same `state` bag and pick only what they need, so callers never see which program
// they're talking to.
import { MADCOW_DAYS, MADCOW_DAY_MOOD, EXERCISE_INCREMENTS, MADCOW_WEEKLY_INCREMENTS } from './constants';
import { getProgramExercises, getMadcowDayExercises, getMadcowDayLiftIds, normalizePreset } from './utils';

export const PROGRAMS = {
  standard: {
    id: 'standard',
    days: ['A', 'B'],
    ramped: false,          // flat per-session weight -> editable, uniform sets/reps meta
    editableWeights: true,  // pencil affordance on the Train idle screen
    usesDeloads: true,      // the 3-consecutive-miss forced-deload flow applies
    nameKey: 'program.strip.standardName',
    subKey: 'program.strip.standardSub',
    increments: EXERCISE_INCREMENTS,
    dayMood: () => null,
    liftIds: (day, s) => getProgramExercises(day, s.program).map(ex => ex.id),
    dayExercises: (day, s) => getProgramExercises(day, s.program).map(ex => ({ ...ex, weight: s.weights[ex.id] })),
  },
  madcow: {
    id: 'madcow',
    days: MADCOW_DAYS,
    ramped: true,           // per-set weights vary -> read-only weight, ramp meta, per-set labels
    editableWeights: false,
    usesDeloads: false,     // progression/regression is handled by the weekly rollover instead
    nameKey: 'program.strip.madcowName',
    subKey: 'program.strip.madcowSub',
    increments: MADCOW_WEEKLY_INCREMENTS,
    dayMood: (day) => MADCOW_DAY_MOOD[day],
    liftIds: (day, s) => getMadcowDayLiftIds(day, s.mcPress),
    dayExercises: (day, s) => getMadcowDayExercises(day, s.mcTop, s.mcInterval, s.mcPress),
  },
};

export const PROGRAM_IDS = Object.keys(PROGRAMS);

// Defends against a corrupt/legacy preset the same way normalizePreset does elsewhere --
// always returns a real registry entry, never undefined.
export function getProgram(id) {
  return PROGRAMS[normalizePreset(id)];
}

// Every lift a program trains across all of its days, in day order with duplicates
// dropped (e.g. Standard's squat, which appears on both A and B). Used by Stats to
// build its lift list without re-deriving day/lift logic itself.
export function programAllLiftIds(id, state) {
  const prog = getProgram(id);
  const seen = new Set();
  const ids = [];
  for (const day of prog.days) {
    for (const liftId of prog.liftIds(day, state)) {
      if (!seen.has(liftId)) { seen.add(liftId); ids.push(liftId); }
    }
  }
  return ids;
}

// The heaviest weight in an exercise entry: the single working weight for a flat
// Standard entry, or the top of the ramp (last set, or the triple before a back-off)
// for a Madcow entry. Mirrors the topIndex logic in ExerciseCard/utils.
export function topWeightOf(ex) {
  return Array.isArray(ex.setWeights) ? Math.max(...ex.setWeights) : ex.weight;
}
