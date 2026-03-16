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
  deadlift: 'Deadlift'
};

export const INITIAL_WEIGHTS = { squat: 20, bench: 20, row: 20, press: 20, deadlift: 40 };
export const STORAGE_KEY = 'strength5x5_data';
export const SCHEMA_VERSION = 1;
export const EXPECTED_WEIGHT_KEYS = ['squat', 'bench', 'row', 'press', 'deadlift'];
export const MAX_IMPORT_SIZE = 5 * 1024 * 1024;
export const ACTIVE_WORKOUT_KEY = 'strength5x5_active_workout';
