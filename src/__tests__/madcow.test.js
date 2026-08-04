import { describe, it, expect } from 'vitest';
import { clampMcTop, reviseWorkoutTopSet } from '../madcow';
import { getMadcowDayExercises } from '../utils';
import { MADCOW_DEFAULT_INTERVAL } from '../constants';

const MC_TOP = { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 };

function workoutFor(day, mcTop = MC_TOP) {
  const exercises = getMadcowDayExercises(day, mcTop, MADCOW_DEFAULT_INTERVAL, 'incline')
    .map(ex => ({ ...ex, setsCompleted: new Array(ex.sets).fill(null) }));
  return { type: day, exercises };
}

describe('clampMcTop', () => {
  it('floors at the lift\'s initial weight', () => {
    expect(clampMcTop('squat', 10)).toBe(20);
    expect(clampMcTop('squat', 90)).toBe(90);
  });
});

describe('reviseWorkoutTopSet', () => {
  it('re-derives only the sets not yet logged, leaving logged sets at the weight actually lifted', () => {
    const workout = workoutFor('A');
    const squatIdx = workout.exercises.findIndex(e => e.id === 'squat');
    workout.exercises[squatIdx].setsCompleted = [5, 5, 5, null, null];
    expect(workout.exercises[squatIdx].setWeights).toEqual([55, 67.5, 80, 95, 107.5]);

    const revised = reviseWorkoutTopSet(workout, 'squat', 110, MADCOW_DEFAULT_INTERVAL);
    const revisedSquat = revised.exercises[squatIdx];

    // Sets 1-3 were already lifted at 55/67.5/80 -- bumping the top set must not
    // rewrite those into the new ramp's own 55/70/82.5.
    expect(revisedSquat.setWeights.slice(0, 3)).toEqual([55, 67.5, 80]);
    // Sets 4-5 haven't happened yet, so they pick up the re-derived ramp toward 110.
    expect(revisedSquat.setWeights.slice(3)).toEqual([97.5, 110]);
    expect(revisedSquat.weight).toBe(110);
    // Untouched exercises pass through unchanged.
    expect(revised.exercises.find(e => e.id === 'bench')).toBe(workout.exercises.find(e => e.id === 'bench'));
  });

  it('re-derives every set when nothing has been logged yet', () => {
    const workout = workoutFor('A');
    const squatIdx = workout.exercises.findIndex(e => e.id === 'squat');
    const revised = reviseWorkoutTopSet(workout, 'squat', 110, MADCOW_DEFAULT_INTERVAL);
    expect(revised.exercises[squatIdx].setWeights).toEqual([55, 70, 82.5, 97.5, 110]);
  });

  it('is a no-op when the lift is not part of the current workout', () => {
    const workout = workoutFor('B'); // no bench on Workout B
    const revised = reviseWorkoutTopSet(workout, 'bench', 70, MADCOW_DEFAULT_INTERVAL);
    expect(revised).toBe(workout);
  });

  it('is a no-op when there is no active workout', () => {
    expect(reviseWorkoutTopSet(null, 'squat', 110, MADCOW_DEFAULT_INTERVAL)).toBe(null);
  });
});
