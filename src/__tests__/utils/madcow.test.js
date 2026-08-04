import { describe, it, expect } from 'vitest';
import {
  seedInclineWeight,
  seedMadcowTops,
  normalizeMcTop,
  madcowTopsToWeights,
  madcowPhase,
  projectOnrampMcTop,
  computeRampWeights,
  getMadcowDayExercises,
  getMadcowDayLiftIds,
  evaluateMadcowOutcome,
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
    expect(seeded.bench).toBe(60);
    expect(seeded.row).toBe(65);
    expect(seeded.deadlift).toBe(117.5);
  });

  it('seeds incline at 80% of bench, then backs it off for week 1', () => {
    expect(seedInclineWeight(67.5)).toBe(55);
    const seeded = seedMadcowTops(STANDARD_WEIGHTS);
    expect(seeded.incline).toBe(47.5);
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
    expect(result.bench).toBe(60);
  });

  it('snaps a stored value that predates the 2.5kg grid enforcement back onto it', () => {
    const result = normalizeMcTop({ squat: 106.25 }, STANDARD_WEIGHTS);
    expect(result.squat).toBe(107.5);
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

describe('projectOnrampMcTop', () => {
  const week1Top = seedMadcowTops(STANDARD_WEIGHTS); // squat 107.5

  it('walks the fixed weekly increment forward to a later on-ramp week', () => {
    const projected = projectOnrampMcTop(week1Top, 1, 3);
    expect(projected.squat).toBe(112.5);
    expect(projected.bench).toBe(65);
  });

  it('walks it backward too, for previewing an earlier on-ramp week', () => {
    const week3Top = projectOnrampMcTop(week1Top, 1, 3);
    expect(projectOnrampMcTop(week3Top, 3, 1).squat).toBe(week1Top.squat);
  });

  it('is a no-op for the same week', () => {
    expect(projectOnrampMcTop(week1Top, 2, 2)).toBe(week1Top);
  });

  it('refuses to project once either week is past the on-ramp, since progression there is performance-gated, not arithmetic', () => {
    expect(projectOnrampMcTop(week1Top, 5, 3)).toBe(week1Top);
    expect(projectOnrampMcTop(week1Top, 1, 5)).toBe(week1Top);
  });
});

describe('computeRampWeights', () => {
  it('matches the verified squat ramp (top 107.5, 12.5% interval, 2.5kg rounding)', () => {
    expect(computeRampWeights(107.5, MADCOW_DEFAULT_INTERVAL, 2.5, 20)).toEqual([55, 67.5, 80, 95, 107.5]);
  });

  it('never rounds a ramp rung finer than 2.5kg, even when passed the old fractional 1.25kg increment', () => {
    expect(computeRampWeights(63.75, MADCOW_DEFAULT_INTERVAL, 1.25, 20)).toEqual([32.5, 40, 47.5, 55, 65]);
  });

  it('matches the verified row ramp, forced onto the 2.5kg grid the same way', () => {
    expect(computeRampWeights(68.75, MADCOW_DEFAULT_INTERVAL, 1.25, 20)).toEqual([35, 42.5, 52.5, 60, 70]);
  });

  it('matches the verified deadlift ramp (40kg bar floor)', () => {
    expect(computeRampWeights(117.5, MADCOW_DEFAULT_INTERVAL, 2.5, 40)).toEqual([60, 72.5, 87.5, 102.5, 117.5]);
  });
});

describe('getMadcowDayExercises', () => {
  const mcTop = { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 };

  it('builds Workout A as a plain 5-set ramp per lift', () => {
    const [squat, bench, row] = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(squat.setWeights).toEqual([55, 67.5, 80, 95, 107.5]);
    expect(squat.setReps).toEqual([5, 5, 5, 5, 5]);
    expect(bench.setWeights).toEqual([32.5, 40, 50, 57.5, 65]);
    expect(row.setWeights).toEqual([35, 45, 52.5, 62.5, 70]);
  });

  it('builds Workout C as a 4-set ramp plus a triple and a back-off eight', () => {
    const [squat, bench, row] = getMadcowDayExercises('C', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(squat.setWeights).toEqual([55, 67.5, 80, 95, 110, 80]);
    expect(squat.setReps).toEqual([5, 5, 5, 5, 3, 8]);
    expect(bench.setWeights).toEqual([32.5, 40, 50, 57.5, 67.5, 50]);
    expect(row.setWeights).toEqual([35, 45, 52.5, 62.5, 72.5, 52.5]);
  });

  it('builds Workout B: light squat repeating rung 3, second press and deadlift ramping to full top', () => {
    const [squat, incline, deadlift] = getMadcowDayExercises('B', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(squat.setWeights).toEqual([55, 67.5, 80, 80]);
    expect(incline.id).toBe('incline');
    expect(incline.setWeights).toEqual([32.5, 37.5, 45, 50]);
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
  const mcTop = { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 };

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
    const result = evaluateMadcowOutcome('A', exercises, mcTop, 1, [], MADCOW_ONRAMP_WEEKS);
    expect(result.nextTop).toEqual(mcTop);
    expect(result.progressions).toEqual([]);
    expect(result.nextWeek).toBe(1);

    const cExercises = getMadcowDayExercises('C', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
    const rollover = evaluateMadcowOutcome('C', cExercises, mcTop, 1, [], MADCOW_ONRAMP_WEEKS);
    expect(rollover.nextWeek).toBe(2);
    expect(rollover.nextTop.squat).toBe(110);
    expect(rollover.nextTop.bench).toBe(67.5);
    expect(rollover.nextTop.incline).toBe(52.5);
  });

  it('reaches the full Standard weight exactly at week `onrampWeeks`', () => {
    // Starts from the actual week-1 seed (not the generic mcTop fixture above), since
    // this checks that seed + (onrampWeeks-1) weekly increments lands exactly back on
    // the Standard weight it was seeded from.
    let top = seedMadcowTops(STANDARD_WEIGHTS);
    let week = 1;
    for (let i = 0; i < MADCOW_ONRAMP_WEEKS - 1; i++) {
      const cExercises = getMadcowDayExercises('C', top, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
      const result = evaluateMadcowOutcome('C', cExercises, top, week, [], MADCOW_ONRAMP_WEEKS);
      top = result.nextTop; week = result.nextWeek;
    }
    expect(week).toBe(MADCOW_ONRAMP_WEEKS);
    expect(top.squat).toBe(115);
    expect(top.bench).toBe(67.5);
    expect(top.row).toBe(72.5);
  });

  it('queues squat/bench/row on a passed Workout A once past the on-ramp, without moving the live top set yet', () => {
    const exercises = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
    const result = evaluateMadcowOutcome('A', exercises, mcTop, MADCOW_ONRAMP_WEEKS, [], MADCOW_ONRAMP_WEEKS);
    // The top set itself doesn't move until Friday's rollover -- Wednesday's squat ramp
    // and Friday's `top + increment` attempt both still need this week's actual Monday weight.
    expect(result.nextTop).toEqual(mcTop);
    expect(result.nextPending.sort()).toEqual(['bench', 'row', 'squat']);
    expect(result.progressions.sort()).toEqual(['bench', 'row', 'squat']);
    // The completion summary still projects the eventual weight, for display only.
    expect(result.projectedTop.squat).toBe(110);
    expect(result.projectedTop.bench).toBe(67.5);
    expect(result.projectedTop.row).toBe(72.5);
  });

  it('holds the top set when the heaviest set is missed', () => {
    const exercises = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(failedTopSet);
    const result = evaluateMadcowOutcome('A', exercises, mcTop, MADCOW_ONRAMP_WEEKS, [], MADCOW_ONRAMP_WEEKS);
    expect(result.nextTop).toEqual(mcTop);
    expect(result.nextPending).toEqual([]);
    expect(result.progressions).toEqual([]);
  });

  it('advances the second press and deadlift on a passed Workout B immediately, but never squat', () => {
    const exercises = getMadcowDayExercises('B', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
    const result = evaluateMadcowOutcome('B', exercises, mcTop, MADCOW_ONRAMP_WEEKS, [], MADCOW_ONRAMP_WEEKS);
    expect(result.progressions.sort()).toEqual(['deadlift', 'incline']);
    expect(result.nextTop.squat).toBe(mcTop.squat);
    // Unlike Workout A, B's press/deadlift bump the live top set right away -- neither
    // lift is read again before next Wednesday, so there's no same-week Friday to overshoot.
    expect(result.nextTop.deadlift).toBe(120);
    expect(result.nextTop.incline).toBe(52.5);
    expect(result.nextPending).toEqual([]);
  });

  it('never advances top sets from Workout C, only the week counter', () => {
    const exercises = getMadcowDayExercises('C', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
    const result = evaluateMadcowOutcome('C', exercises, mcTop, MADCOW_ONRAMP_WEEKS, [], MADCOW_ONRAMP_WEEKS);
    expect(result.progressions).toEqual([]);
    expect(result.nextTop).toEqual(mcTop);
    expect(result.nextWeek).toBe(MADCOW_ONRAMP_WEEKS + 1);
  });

  it('applies a queued Workout A bump at the Friday rollover, then clears the queue', () => {
    const cExercises = getMadcowDayExercises('C', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(passedExercise);
    const result = evaluateMadcowOutcome('C', cExercises, mcTop, MADCOW_ONRAMP_WEEKS, ['squat', 'bench'], MADCOW_ONRAMP_WEEKS);
    expect(result.nextTop.squat).toBe(110);
    expect(result.nextTop.bench).toBe(67.5);
    expect(result.nextTop.row).toBe(mcTop.row); // row never passed Monday, wasn't queued
    expect(result.nextPending).toEqual([]);
  });

  // Regression coverage for the "Friday's top set is one increment too heavy" bug: a
  // full two-week trace, squat passing Monday every week, verified against StrongLifts'
  // published Madcow numbers (Monday 100 -> Friday 102.5 -> Monday 102.5 -> Friday 105).
  it('keeps Friday exactly one increment above the current week\'s Monday top, week over week', () => {
    const squatTop = { squat: 100 };
    const squatOnly = (day, top) => getMadcowDayExercises(day, { ...top, bench: 1, row: 1, deadlift: 1, press: 1, incline: 1 }, MADCOW_DEFAULT_INTERVAL, 'incline').filter(ex => ex.id === 'squat');

    let top = squatTop;
    let pending = [];
    const week = MADCOW_ONRAMP_WEEKS; // past on-ramp, progression is live

    // Week N: Monday passes.
    const [mondayEx] = squatOnly('A', top);
    expect(mondayEx.weight).toBe(100); // week N's actual Monday top set
    let outcome = evaluateMadcowOutcome('A', [passedExercise(mondayEx)], top, week, pending, MADCOW_ONRAMP_WEEKS);
    top = outcome.nextTop; pending = outcome.nextPending;

    // Week N: Friday's attempt is still only one increment above Monday's actual weight.
    const [fridayEx] = squatOnly('C', top);
    expect(fridayEx.weight).toBe(102.5);
    outcome = evaluateMadcowOutcome('C', [passedExercise(fridayEx)], top, week, pending, MADCOW_ONRAMP_WEEKS);
    top = outcome.nextTop; pending = outcome.nextPending;

    // Week N+1: Monday's top set has advanced by exactly one increment.
    const [monday2] = squatOnly('A', top);
    expect(monday2.weight).toBe(102.5);
    outcome = evaluateMadcowOutcome('A', [passedExercise(monday2)], top, week + 1, pending, MADCOW_ONRAMP_WEEKS);
    top = outcome.nextTop; pending = outcome.nextPending;

    // Week N+1: Friday is one increment above week N+1's Monday, not two.
    const [friday2] = squatOnly('C', top);
    expect(friday2.weight).toBe(105);
  });

  it('still adds Friday\'s increment when Monday was missed, since Friday is a fresh attempt regardless', () => {
    const exercises = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline').map(failedTopSet);
    const outcome = evaluateMadcowOutcome('A', exercises, mcTop, MADCOW_ONRAMP_WEEKS, [], MADCOW_ONRAMP_WEEKS);
    const [fridaySquat] = getMadcowDayExercises('C', outcome.nextTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(fridaySquat.weight).toBe(mcTop.squat + 2.5);
  });
});

describe('restSeconds', () => {
  const mcTop = { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 };

  it('ramps Workout A rest from short to long, ending long before the top set', () => {
    const [squat] = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(squat.restSeconds).toEqual([0, 90, 180, 180, 300]);
  });

  it('gives Workout C\'s 8-rep back-off set the normal (3min) rest, not the short tier its lighter weight would otherwise suggest', () => {
    const [squat] = getMadcowDayExercises('C', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(squat.restSeconds).toEqual([0, 90, 180, 180, 300, 180]);
  });

  it('caps Workout B\'s squat at the normal tier, since it\'s recovery volume and never a true top set', () => {
    const [squat] = getMadcowDayExercises('B', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(squat.restSeconds).toEqual([0, 90, 180, 180]);
  });

  it('gives Workout B\'s press/deadlift long rest before their top set, normal before the two sets building to it', () => {
    const [, incline, deadlift] = getMadcowDayExercises('B', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(incline.restSeconds).toEqual([0, 180, 180, 300]);
    expect(deadlift.restSeconds).toEqual([0, 180, 180, 300]);
  });
});

describe('computeProjectedVolume', () => {
  const mcTop = { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 };

  it('matches the verified Workout A total (4,575 kg)', () => {
    const exercises = getMadcowDayExercises('A', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(computeProjectedVolume(exercises)).toBe(4575);
  });

  it('matches the verified Workout B total (4,138 kg)', () => {
    const exercises = getMadcowDayExercises('B', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(computeProjectedVolume(exercises)).toBe(4138);
  });

  it('matches the verified Workout C total (5,573 kg)', () => {
    const exercises = getMadcowDayExercises('C', mcTop, MADCOW_DEFAULT_INTERVAL, 'incline');
    expect(computeProjectedVolume(exercises)).toBe(5573);
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
    expect(roundWeight(53.6, 2.5, 20)).toBe(52.5);
    expect(roundWeight(5, 2.5, 20)).toBe(20);
  });

  it('never snaps finer than the 2.5kg plate grid, even when asked to', () => {
    expect(roundWeight(53.6, 1.25, 20)).toBe(52.5);
  });

  it('falls back to the minimum increment for a non-finite or non-positive increment, rather than returning NaN', () => {
    expect(roundWeight(53.6, NaN, 20)).toBe(52.5);
    expect(roundWeight(53.6, 0, 20)).toBe(52.5);
    expect(roundWeight(53.6, -5, 20)).toBe(52.5);
  });
});
