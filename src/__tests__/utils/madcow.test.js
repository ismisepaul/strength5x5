import { describe, it, expect } from 'vitest';
import {
  seedInclineWeight,
  seedMadcowTops,
  normalizeMcTop,
  madcowTopsToWeights,
  madcowPhase,
  computeRampWeights,
  getMadcowDayExercises,
  getMadcowDayLiftIds,
  evaluateMadcowOutcome,
  madcowRestSeconds,
  roundWeight,
  computeProjectedVolume,
  wentUpLastTime,
} from '../../utils';
import { MADCOW_ONRAMP_WEEKS, MADCOW_DEFAULT_INTERVAL } from '../../constants';

// Reference lifter: squat 115, bench 67.5, row 72.5, press 55, deadlift 125 on Standard.
const STANDARD_WEIGHTS = { squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125 };

describe('seedMadcowTops', () => {
  it('seeds week-1 top sets three weekly increments below the Standard weight', () => {
    const seeded = seedMadcowTops(STANDARD_WEIGHTS);
    expect(seeded.squat).toBe(107.5);
    expect(seeded.bench).toBe(63.75);
    expect(seeded.row).toBe(68.75);
    expect(seeded.deadlift).toBe(117.5);
  });

  it('seeds incline at 80% of bench, then backs it off for week 1', () => {
    expect(seedInclineWeight(67.5)).toBe(53.75);
    const seeded = seedMadcowTops(STANDARD_WEIGHTS);
    expect(seeded.incline).toBe(50);
  });

  it('reaches the exact Standard weight at the final on-ramp week', () => {
    const full = seedMadcowTops(STANDARD_WEIGHTS, 1);
    expect(full.squat).toBe(115);
    expect(full.bench).toBe(67.5);
    expect(full.row).toBe(72.5);
  });
});

describe('normalizeMcTop', () => {
  it('fills missing keys from a fresh seed and passes through valid numbers', () => {
    const result = normalizeMcTop({ squat: 110 }, STANDARD_WEIGHTS);
    expect(result.squat).toBe(110);
    expect(result.bench).toBe(63.75);
  });

  it('reseeds entirely when given nothing', () => {
    const result = normalizeMcTop(null, STANDARD_WEIGHTS);
    expect(result).toEqual(seedMadcowTops(STANDARD_WEIGHTS));
  });
});

describe('madcowTopsToWeights', () => {
  it('carries every top set back as the flat Standard working weight', () => {
    const mcTop = { squat: 120, bench: 70, row: 75, deadlift: 130, press: 60, incline: 55 };
    const result = madcowTopsToWeights(STANDARD_WEIGHTS, mcTop, 'press');
    expect(result.squat).toBe(120);
    expect(result.bench).toBe(70);
    expect(result.row).toBe(75);
    expect(result.deadlift).toBe(130);
    expect(result.press).toBe(60);
  });

  it('leaves Standard press untouched when incline was the active second press', () => {
    const mcTop = { squat: 120, bench: 70, row: 75, deadlift: 130, press: 60, incline: 55 };
    const result = madcowTopsToWeights(STANDARD_WEIGHTS, mcTop, 'incline');
    expect(result.press).toBe(STANDARD_WEIGHTS.press);
  });
});

describe('madcowPhase', () => {
  it('reports onramp, matching, then record territory', () => {
    expect(madcowPhase(1)).toBe('onramp');
    expect(madcowPhase(3)).toBe('onramp');
    expect(madcowPhase(4)).toBe('matching');
    expect(madcowPhase(5)).toBe('record');
  });
});

describe('computeRampWeights', () => {
  it('matches the verified squat ramp (top 107.5, 12.5% interval, 2.5kg rounding)', () => {
    expect(computeRampWeights(107.5, MADCOW_DEFAULT_INTERVAL, 2.5, 20)).toEqual([55, 67.5, 80, 95, 107.5]);
  });

  it('matches the verified bench ramp (fractional 1.25kg rounding)', () => {
    expect(computeRampWeights(63.75, MADCOW_DEFAULT_INTERVAL, 1.25, 20)).toEqual([32.5, 40, 47.5, 56.25, 63.75]);
  });

  it('matches the verified row ramp', () => {
    expect(computeRampWeights(68.75, MADCOW_DEFAULT_INTERVAL, 1.25, 20)).toEqual([35, 42.5, 51.25, 60, 68.75]);
  });

  it('matches the verified deadlift ramp (40kg bar floor)', () => {
    expect(computeRampWeights(117.5, MADCOW_DEFAULT_INTERVAL, 2.5, 40)).toEqual([60, 72.5, 87.5, 102.5, 117.5]);
  });
});

describe('getMadcowDayExercises', () => {
  const mcTop = { squat: 107.5, bench: 63.75, row: 68.75, deadlift: 117.5, press: 55, incline: 50 };

  it('builds Workout A as a plain 5-set ramp per lift', () => {
    const [squat, bench, row] = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(squat.setWeights).toEqual([55, 67.5, 80, 95, 107.5]);
    expect(squat.setReps).toEqual([5, 5, 5, 5, 5]);
    expect(bench.setWeights).toEqual([32.5, 40, 47.5, 56.25, 63.75]);
    expect(row.setWeights).toEqual([35, 42.5, 51.25, 60, 68.75]);
  });

  it('builds Workout C as a 4-set ramp plus a triple and a back-off eight', () => {
    const [squat, bench, row] = getMadcowDayExercises('C', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(squat.setWeights).toEqual([55, 67.5, 80, 95, 110, 80]);
    expect(squat.setReps).toEqual([5, 5, 5, 5, 3, 8]);
    expect(bench.setWeights).toEqual([32.5, 40, 47.5, 56.25, 65, 47.5]);
    expect(row.setWeights).toEqual([35, 42.5, 51.25, 60, 70, 51.25]);
  });

  it('builds Workout B: light squat repeating rung 3, second press and deadlift ramping to full top', () => {
    const [squat, incline, deadlift] = getMadcowDayExercises('B', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(squat.setWeights).toEqual([55, 67.5, 80, 80]);
    expect(incline.id).toBe('incline');
    expect(incline.setWeights).toEqual([31.25, 37.5, 43.75, 50]);
    expect(deadlift.setWeights).toEqual([72.5, 87.5, 102.5, 117.5]);
  });

  it('resolves the second-press slot to the overhead press when chosen', () => {
    const [, press] = getMadcowDayExercises('B', mcTop, MADCOW_DEFAULT_INTERVAL, 'press');
    expect(press.id).toBe('press');
  });

  it('getMadcowDayLiftIds mirrors the resolved lift order', () => {
    expect(getMadcowDayLiftIds('B', 'incline')).toEqual(['squat', 'incline', 'deadlift']);
    expect(getMadcowDayLiftIds('A', 'incline')).toEqual(['squat', 'bench', 'row']);
  });
});

describe('evaluateMadcowOutcome', () => {
  const mcTop = { squat: 107.5, bench: 63.75, row: 68.75, deadlift: 117.5, press: 55, incline: 50 };

  function passedExercise(ex) {
    return { ...ex, setsCompleted: [...ex.setReps] };
  }
  function failedTopSet(ex) {
    const setsCompleted = [...ex.setReps];
    setsCompleted[setsCompleted.length - 1] -= 1;
    return { ...ex, setsCompleted };
  }

  it('does not touch top sets during the on-ramp, but climbs them on the Friday rollover', () => {
    const exercises = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
    const result = evaluateMadcowOutcome('A', exercises, mcTop, 1, MADCOW_ONRAMP_WEEKS);
    expect(result.nextTop).toEqual(mcTop);
    expect(result.progressions).toEqual([]);
    expect(result.nextWeek).toBe(1);

    const cExercises = getMadcowDayExercises('C', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
    const rollover = evaluateMadcowOutcome('C', cExercises, mcTop, 1, MADCOW_ONRAMP_WEEKS);
    expect(rollover.nextWeek).toBe(2);
    expect(rollover.nextTop.squat).toBe(110);
    expect(rollover.nextTop.bench).toBe(65);
    expect(rollover.nextTop.incline).toBe(51.25);
  });

  it('reaches the full Standard weight exactly at week `onrampWeeks`', () => {
    let top = mcTop;
    let week = 1;
    for (let i = 0; i < MADCOW_ONRAMP_WEEKS - 1; i++) {
      const cExercises = getMadcowDayExercises('C', top, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
      const result = evaluateMadcowOutcome('C', cExercises, top, week, MADCOW_ONRAMP_WEEKS);
      top = result.nextTop; week = result.nextWeek;
    }
    expect(week).toBe(MADCOW_ONRAMP_WEEKS);
    expect(top.squat).toBe(115);
    expect(top.bench).toBe(67.5);
    expect(top.row).toBe(72.5);
  });

  it('advances squat/bench/row on a passed Workout A once past the on-ramp', () => {
    const exercises = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
    const result = evaluateMadcowOutcome('A', exercises, mcTop, MADCOW_ONRAMP_WEEKS, MADCOW_ONRAMP_WEEKS);
    expect(result.nextTop.squat).toBe(110);
    expect(result.nextTop.bench).toBe(65);
    expect(result.nextTop.row).toBe(70);
    expect(result.progressions.sort()).toEqual(['bench', 'row', 'squat']);
  });

  it('holds the top set when the heaviest set is missed', () => {
    const exercises = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(failedTopSet);
    const result = evaluateMadcowOutcome('A', exercises, mcTop, MADCOW_ONRAMP_WEEKS, MADCOW_ONRAMP_WEEKS);
    expect(result.nextTop).toEqual(mcTop);
    expect(result.progressions).toEqual([]);
  });

  it('advances the second press and deadlift on a passed Workout B, but never squat', () => {
    const exercises = getMadcowDayExercises('B', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
    const result = evaluateMadcowOutcome('B', exercises, mcTop, MADCOW_ONRAMP_WEEKS, MADCOW_ONRAMP_WEEKS);
    expect(result.progressions.sort()).toEqual(['deadlift', 'incline']);
    expect(result.nextTop.squat).toBe(mcTop.squat);
  });

  it('never advances top sets from Workout C, only the week counter', () => {
    const exercises = getMadcowDayExercises('C', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
    const result = evaluateMadcowOutcome('C', exercises, mcTop, MADCOW_ONRAMP_WEEKS, MADCOW_ONRAMP_WEEKS);
    expect(result.progressions).toEqual([]);
    expect(result.nextTop).toEqual(mcTop);
    expect(result.nextWeek).toBe(MADCOW_ONRAMP_WEEKS + 1);
  });
});

describe('madcowRestSeconds', () => {
  it('gives long rest near the top, short rest for light ramp sets', () => {
    expect(madcowRestSeconds(107.5, 107.5, 90)).toBe(300);
    expect(madcowRestSeconds(95, 107.5, 90)).toBe(180);
    expect(madcowRestSeconds(55, 107.5, 90)).toBe(90);
  });

  it('falls back to the preferred rest when there is no day top', () => {
    expect(madcowRestSeconds(50, 0, 120)).toBe(120);
  });
});

describe('computeProjectedVolume', () => {
  const mcTop = { squat: 107.5, bench: 63.75, row: 68.75, deadlift: 117.5, press: 55, incline: 50 };

  it('matches the verified Workout A total (4,513 kg)', () => {
    const exercises = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(computeProjectedVolume(exercises)).toBe(4513);
  });

  it('matches the verified Workout B total (4,125 kg)', () => {
    const exercises = getMadcowDayExercises('B', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(computeProjectedVolume(exercises)).toBe(4125);
  });

  it('matches the verified Workout C total (5,478 kg)', () => {
    const exercises = getMadcowDayExercises('C', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(computeProjectedVolume(exercises)).toBe(5478);
  });

  it('handles Standard-shaped uniform exercises (weight x reps x sets)', () => {
    const exercises = [
      { weight: 115, reps: 5, sets: 5 },
      { weight: 67.5, reps: 5, sets: 5 },
      { weight: 72.5, reps: 5, sets: 5 },
    ];
    expect(computeProjectedVolume(exercises)).toBe(6375);
  });
});

describe('wentUpLastTime', () => {
  it('is true when the current weight exceeds the most recent logged weight', () => {
    const history = [{ exercises: [{ id: 'squat', weight: 110 }] }];
    expect(wentUpLastTime(history, 'squat', 112.5)).toBe(true);
  });

  it('is false when the weight held or the lift has no history', () => {
    const history = [{ exercises: [{ id: 'squat', weight: 115 }] }];
    expect(wentUpLastTime(history, 'squat', 115)).toBe(false);
    expect(wentUpLastTime([], 'squat', 115)).toBe(false);
  });
});

describe('roundWeight', () => {
  it('rounds to the nearest increment and floors at the given minimum', () => {
    expect(roundWeight(53.6, 1.25, 20)).toBe(53.75);
    expect(roundWeight(5, 2.5, 20)).toBe(20);
  });
});
