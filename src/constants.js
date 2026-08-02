export const WORKOUTS = {
  A: { name: 'Workout A', exercises: [
    { id: 'squat', name: 'Back Squat', sets: 5, reps: 5, increment: 2.5 },
    { id: 'bench', name: 'Bench Press', sets: 5, reps: 5, increment: 2.5 },
    { id: 'row', name: 'Barbell Row', sets: 5, reps: 5, increment: 2.5 },
  ]},
  B: { name: 'Workout B', exercises: [
    { id: 'squat', name: 'Back Squat', sets: 5, reps: 5, increment: 2.5 },
    { id: 'press', name: 'Overhead Press', sets: 5, reps: 5, increment: 2.5 },
    { id: 'deadlift', name: 'Deadlift', sets: 1, reps: 5, increment: 5 },
  ]}
};

export const EXERCISE_NAMES = {
  squat: 'Back Squat',
  bench: 'Bench Press',
  row: 'Barbell Row',
  press: 'Overhead Press',
  deadlift: 'Deadlift',
  incline: 'Incline Bench',
};

export const INITIAL_WEIGHTS = { squat: 20, bench: 20, row: 20, press: 20, deadlift: 40, incline: 20 };

// Per-exercise weight increment, shared by Standard's session-to-session progression
// and Madcow's weekly top-set progression. Incline's 1.25kg step reflects fractional
// plates, since it rides Bench's heavier working weight on a smaller lift.
export const EXERCISE_INCREMENTS = { squat: 2.5, bench: 2.5, row: 2.5, press: 2.5, deadlift: 5, incline: 1.25 };

// User-customisable programme. WORKOUTS keeps the stock 5x5 shape as a fallback and
// stays the source of exercise order and increments; these override sets/reps only.
export const MIN_SETS = 1;
export const MAX_SETS = 5;
export const MIN_REPS = 1;
export const MAX_REPS = 10;
export const DEFAULT_PROGRAM = {
  squat: { sets: 5, reps: 5 },
  bench: { sets: 5, reps: 5 },
  row: { sets: 5, reps: 5 },
  press: { sets: 5, reps: 5 },
  deadlift: { sets: 1, reps: 5 },
};

// Madcow 5x5: a ramped heavy/light/medium week built around one weekly top set per lift,
// rather than Standard's flat per-session weight. See utils.js for the ramp/progression math.
export const DEFAULT_PRESET = 'standard';
export const MADCOW_DAYS = ['A', 'B', 'C'];
export const MADCOW_DAY_MOOD = { A: 'medium', B: 'light', C: 'heavy' };
// 'SECOND_PRESS' resolves at runtime to whichever lift is chosen (incline or overhead).
export const MADCOW_DAY_LIFTS = {
  A: ['squat', 'bench', 'row'],
  B: ['squat', 'SECOND_PRESS', 'deadlift'],
  C: ['squat', 'bench', 'row'],
};
export const MADCOW_DEFAULT_PRESS = 'incline';
export const MADCOW_PRESS_OPTIONS = ['incline', 'press'];
export const MADCOW_ONRAMP_WEEKS = 4;
export const MADCOW_DEFAULT_INTERVAL = 12.5;
export const MADCOW_INTERVAL_OPTIONS = [10, 12.5, 15];
// Madcow's own weekly top-set progression -- distinct from EXERCISE_INCREMENTS, which
// is Standard's per-session step. Squat/deadlift move in 2.5kg jumps; bench, row and
// the second press move in 1.25kg fractional-plate jumps.
export const MADCOW_WEEKLY_INCREMENTS = { squat: 2.5, bench: 1.25, row: 1.25, press: 1.25, deadlift: 2.5, incline: 1.25 };

export const STORAGE_KEY = 'strength5x5_data';
export const SCHEMA_VERSION = 2;
export const EXPECTED_WEIGHT_KEYS = ['squat', 'bench', 'row', 'press', 'deadlift'];
export const MAX_IMPORT_SIZE = 5 * 1024 * 1024;
export const ACTIVE_WORKOUT_KEY = 'strength5x5_active_workout';
