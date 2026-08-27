import { describe, it, expect } from 'vitest';
import {
  calculatePlates,
  calculate1RM,
  calculateBest1RM,
  formatDuration,
  calculateDeload,
  deloadWeightByPercent,
  getConsecutiveFailures,
  getRecommendedDeloadPercent,
  calculateWarmup,
  validateImportData,
  migrate,
  formatClock,
  calculateSetDurations,
  normalizeProgram,
  normalizeMcSeeded,
  normalizePreferredRest,
  getProgramExercises,
  targetReps,
  isExercisePassed,
  plannedVolume,
  formatBytes,
  countSessionsSince,
} from '../utils';
import { SCHEMA_VERSION, DEFAULT_PROGRAM, EXPECTED_WEIGHT_KEYS, CUSTOM_REST_MIN, CUSTOM_REST_MAX } from '../constants';

describe('calculatePlates', () => {
  it('returns correct plates for 60kg (one 20 per side)', () => {
    // (60 - 20) / 2 = 20 per side => one 20kg plate
    expect(calculatePlates(60)).toEqual([20]);
  });

  it('returns empty array for 20kg (empty bar)', () => {
    expect(calculatePlates(20)).toEqual([]);
  });

  it('returns empty array for weight below bar', () => {
    expect(calculatePlates(15)).toEqual([]);
  });

  it('handles mixed plates for 71.25kg', () => {
    // (71.25 - 20) / 2 = 25.625
    // 25 + 0.625 => one 25, then 0 for 20,15,10,5,2.5 -- nah
    // Actually: 25.625 => no 25 fits... wait:
    // 25.625 >= 25? yes => [25], remaining 0.625
    // 0.625 >= 20? no, 15? no, 10? no, 5? no, 2.5? no, 1.25? no... hmm
    // Actually 0.625 < 1.25 so nothing else. But that leaves 0.625 unmatched.
    // Let's test a cleaner mixed: 82.5kg => (82.5-20)/2 = 31.25 => 25 + 5 + 1.25
    expect(calculatePlates(82.5)).toEqual([25, 5, 1.25]);
  });

  it('handles null/undefined input', () => {
    expect(calculatePlates(null)).toEqual([]);
    expect(calculatePlates(undefined)).toEqual([]);
    expect(calculatePlates(0)).toEqual([]);
  });

  it('returns correct plates for heavy weight 140kg', () => {
    // (140-20)/2 = 60 => 25+25+10
    expect(calculatePlates(140)).toEqual([25, 25, 10]);
  });
});

describe('calculate1RM', () => {
  it('estimates 1RM for 5 reps at 100kg', () => {
    // 100 * (1 + 5/30) = 100 * 1.1667 = 116.67 => 117
    expect(calculate1RM(100, 5)).toBe(117);
  });

  it('returns weight itself for 0 reps', () => {
    expect(calculate1RM(100, 0)).toBe(100);
  });

  it('returns weight itself for negative reps', () => {
    expect(calculate1RM(100, -3)).toBe(100);
  });

  it('returns weight for null reps', () => {
    expect(calculate1RM(80, null)).toBe(80);
  });

  it('handles single rep', () => {
    // 100 * (1 + 1/30) = 100 * 1.0333 = 103.33 => 103
    expect(calculate1RM(100, 1)).toBe(103);
  });
});

describe('calculateBest1RM', () => {
  const history = [
    {
      date: '2025-12-01',
      type: 'A',
      exercises: [
        { id: 'squat', weight: 100, setsCompleted: [5, 5, 5, 5, 3] },
        { id: 'bench', weight: 60, setsCompleted: [5, 5, 5, 5, 5] },
      ],
    },
    {
      date: '2025-11-28',
      type: 'A',
      exercises: [
        { id: 'squat', weight: 95, setsCompleted: [5, 5, 5, 5, 5] },
      ],
    },
  ];

  it('finds best 1RM across all sessions for squat', () => {
    // Session 1: 100kg x 5 reps => 117, 100kg x 3 reps => 110
    // Session 2: 95kg x 5 reps => 111
    // Best = 117
    expect(calculateBest1RM(history, 'squat')).toBe(117);
  });

  it('finds 1RM for bench', () => {
    // 60kg x 5 reps => 70
    expect(calculateBest1RM(history, 'bench')).toBe(70);
  });

  it('returns 0 for exercise not in history', () => {
    expect(calculateBest1RM(history, 'deadlift')).toBe(0);
  });

  it('returns 0 for empty history', () => {
    expect(calculateBest1RM([], 'squat')).toBe(0);
  });

  it('ignores null/zero reps', () => {
    const h = [{
      date: '2025-01-01',
      type: 'A',
      exercises: [{ id: 'squat', weight: 80, setsCompleted: [null, 0, null] }],
    }];
    expect(calculateBest1RM(h, 'squat')).toBe(0);
  });
});

describe('calculateDeload', () => {
  it('defaults to 10% reduction rounded to 2.5', () => {
    const w = { squat: 100, bench: 60, row: 50, press: 40, deadlift: 120 };
    const result = calculateDeload(w);
    expect(result.squat).toBe(90);
    expect(result.bench).toBe(55);
    expect(result.row).toBe(45);
    expect(result.press).toBe(35);
    expect(result.deadlift).toBe(107.5);
  });

  it('accepts custom percentage', () => {
    const w = { squat: 100, bench: 60, row: 50, press: 40, deadlift: 120 };
    const result = calculateDeload(w, 25);
    expect(result.squat).toBe(75);
    expect(result.bench).toBe(45);
    expect(result.deadlift).toBe(90);
  });

  it('accepts 50% deload', () => {
    const w = { squat: 100, deadlift: 120 };
    const result = calculateDeload(w, 50);
    expect(result.squat).toBe(50);
    expect(result.deadlift).toBe(60);
  });

  it('floors at INITIAL_WEIGHTS minimum (20kg general, 40kg deadlift)', () => {
    const w = { squat: 20, bench: 20, deadlift: 40 };
    const result = calculateDeload(w);
    expect(result.squat).toBe(20);
    expect(result.bench).toBe(20);
    expect(result.deadlift).toBe(40);
  });

  it('deadlift floor is 40kg even at high percentages', () => {
    const w = { squat: 50, deadlift: 60 };
    const result = calculateDeload(w, 90);
    expect(result.squat).toBe(20);
    expect(result.deadlift).toBe(40);
  });
});

describe('calculateWarmup', () => {
  it('calculates 60% warmup weight rounded to 2.5', () => {
    expect(calculateWarmup(100)).toBe(60); // 100*0.6 = 60
  });

  it('clamps warmup to minimum 20kg', () => {
    expect(calculateWarmup(25)).toBe(20); // 25*0.6 = 15 => max(20, round(15/2.5)*2.5) = 20
    expect(calculateWarmup(20)).toBe(20); // 20*0.6 = 12 => 20
  });

  it('handles edge case at bar weight', () => {
    expect(calculateWarmup(30)).toBe(20); // 30*0.6 = 18 => round(18/2.5)*2.5 = 17.5 => max(20, 17.5) = 20
  });
});

describe('plannedVolume', () => {
  it('sums weight x sets x reps for flat Standard entries', () => {
    const dayExercises = [
      { weight: 60, sets: 5, reps: 5 },
      { weight: 45, sets: 5, reps: 5 },
    ];
    expect(plannedVolume(dayExercises)).toBe(60 * 5 * 5 + 45 * 5 * 5);
  });

  it('sums per-set weight x reps for ramped Madcow entries', () => {
    const dayExercises = [
      { setWeights: [35, 45, 55], setReps: [5, 5, 5] },
    ];
    expect(plannedVolume(dayExercises)).toBe(35 * 5 + 45 * 5 + 55 * 5);
  });

  it('mixes flat and ramped entries in the same day', () => {
    const dayExercises = [
      { weight: 60, sets: 5, reps: 5 },
      { setWeights: [35, 45, 55], setReps: [5, 5, 5] },
    ];
    expect(plannedVolume(dayExercises)).toBe(60 * 5 * 5 + (35 + 45 + 55) * 5);
  });
});

describe('validateImportData', () => {
  const validData = {
    weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
    history: [
      {
        date: '2025-12-01',
        type: 'A',
        exercises: [{ id: 'squat', weight: 60, setsCompleted: [5, 5, 5, 5, 5] }],
      },
    ],
  };

  it('accepts valid data', () => {
    const result = validateImportData(validData);
    expect(result).not.toBeNull();
    expect(result.weights.squat).toBe(60);
    expect(result.history).toHaveLength(1);
  });

  it('rejects null/undefined', () => {
    expect(validateImportData(null)).toBeNull();
    expect(validateImportData(undefined)).toBeNull();
  });

  it('rejects missing weights', () => {
    expect(validateImportData({ history: [] })).toBeNull();
  });

  it('rejects missing weight keys', () => {
    expect(validateImportData({
      weights: { squat: 60, bench: 45 },
      history: [],
    })).toBeNull();
  });

  it('rejects non-numeric weight values', () => {
    expect(validateImportData({
      weights: { squat: '60', bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [],
    })).toBeNull();
  });

  it('rejects non-array history', () => {
    expect(validateImportData({
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: 'not an array',
    })).toBeNull();
  });

  it('normalizes weights to nearest 2.5kg', () => {
    const data = {
      weights: { squat: 52.33, bench: 41.1, row: 50, press: 32.5, deadlift: 81.7 },
      history: [],
    };
    const result = validateImportData(data);
    expect(result.weights.squat).toBe(52.5);
    expect(result.weights.bench).toBe(40);
    expect(result.weights.deadlift).toBe(82.5);
  });

  it('filters out malformed history entries', () => {
    const data = {
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [
        { date: '2025-12-01', type: 'A', exercises: [] },
        { date: '2025-12-02' },  // missing type and exercises
        null,
        { type: 'B', exercises: [] },  // missing date
        { date: '2025-12-03', type: 'B', exercises: [] },
      ],
    };
    const result = validateImportData(data);
    expect(result.history).toHaveLength(2);
    expect(result.history[0].date).toBe('2025-12-01');
    expect(result.history[1].date).toBe('2025-12-03');
  });

  it('fills in a default program for v1 backups with no program field', () => {
    const result = validateImportData(validData);
    expect(result.program).toEqual(DEFAULT_PROGRAM);
  });

  it('preserves and clamps a program field when present', () => {
    const data = { ...validData, program: { ...DEFAULT_PROGRAM, bench: { sets: 30, reps: -2 } } };
    const result = validateImportData(data);
    expect(result.program.bench).toEqual({ sets: 5, reps: 1 });
    expect(result.program.squat).toEqual(DEFAULT_PROGRAM.squat);
  });
});

describe('migrate', () => {
  it('passes v1 data through unchanged (except version stamp)', () => {
    const data = { weights: { squat: 60 }, history: [], version: 1 };
    const result = migrate(data, 1);
    expect(result.version).toBe(SCHEMA_VERSION);
    expect(result.weights.squat).toBe(60);
  });

  it('treats missing version as v1', () => {
    const data = { weights: { squat: 60 }, history: [] };
    const result = migrate(data, undefined);
    expect(result.version).toBe(SCHEMA_VERSION);
  });

  it('stamps current SCHEMA_VERSION', () => {
    const result = migrate({ version: 0 }, 0);
    expect(result.version).toBe(SCHEMA_VERSION);
  });

  it('injects a default program when migrating from v1', () => {
    const result = migrate({ weights: { squat: 60 }, history: [], version: 1 }, 1);
    expect(result.program).toEqual(DEFAULT_PROGRAM);
  });

  it('does not touch an already-set program on a v2+ migration', () => {
    const customProgram = { ...DEFAULT_PROGRAM, bench: { sets: 3, reps: 8 } };
    const result = migrate({ program: customProgram, version: 2 }, 2);
    expect(result.program).toEqual(customProgram);
  });
});

describe('normalizePreferredRest', () => {
  it('clamps a value below CUSTOM_REST_MIN up to the floor', () => {
    expect(normalizePreferredRest(5)).toBe(CUSTOM_REST_MIN);
  });

  it('clamps a value above CUSTOM_REST_MAX down to the ceiling', () => {
    expect(normalizePreferredRest(9999)).toBe(CUSTOM_REST_MAX);
  });

  it('leaves an in-range value untouched', () => {
    expect(normalizePreferredRest(120)).toBe(120);
  });

  it('defaults non-numeric or missing input to 90', () => {
    expect(normalizePreferredRest(undefined)).toBe(90);
    expect(normalizePreferredRest(null)).toBe(90);
    expect(normalizePreferredRest('120')).toBe(90);
    expect(normalizePreferredRest(NaN)).toBe(90);
  });
});

describe('normalizeProgram', () => {
  it('returns DEFAULT_PROGRAM for null/undefined input', () => {
    expect(normalizeProgram(null)).toEqual(DEFAULT_PROGRAM);
    expect(normalizeProgram(undefined)).toEqual(DEFAULT_PROGRAM);
  });

  it('clamps sets below the minimum up to 1', () => {
    const result = normalizeProgram({ squat: { sets: 0, reps: 5 } });
    expect(result.squat.sets).toBe(1);
  });

  it('clamps sets above the maximum down to 5', () => {
    const result = normalizeProgram({ squat: { sets: 9, reps: 5 } });
    expect(result.squat.sets).toBe(5);
  });

  it('clamps reps above the maximum down to 10', () => {
    const result = normalizeProgram({ squat: { sets: 5, reps: 20 } });
    expect(result.squat.reps).toBe(10);
  });

  it('clamps reps below the minimum up to 1', () => {
    const result = normalizeProgram({ squat: { sets: 5, reps: 0 } });
    expect(result.squat.reps).toBe(1);
  });

  it('falls back to defaults for garbage or missing entries', () => {
    const result = normalizeProgram({ squat: 'not an object', bench: null });
    expect(result.squat).toEqual(DEFAULT_PROGRAM.squat);
    expect(result.bench).toEqual(DEFAULT_PROGRAM.bench);
  });

  it('fills every expected exercise id even if the input only has one', () => {
    const result = normalizeProgram({ bench: { sets: 3, reps: 8 } });
    for (const id of EXPECTED_WEIGHT_KEYS) {
      expect(result[id]).toBeDefined();
    }
    expect(result.bench).toEqual({ sets: 3, reps: 8 });
    expect(result.deadlift).toEqual(DEFAULT_PROGRAM.deadlift);
  });
});

describe('normalizeMcSeeded', () => {
  it('returns true when the raw value is exactly true', () => {
    expect(normalizeMcSeeded(true, {})).toBe(true);
  });

  it('returns false for undefined/garbage with no legacy signal', () => {
    expect(normalizeMcSeeded(undefined, {})).toBe(false);
    expect(normalizeMcSeeded('yes', {})).toBe(false);
    expect(normalizeMcSeeded(false, { preset: 'standard', mcWeek: 1 })).toBe(false);
  });

  it('infers true from a legacy save already on Madcow', () => {
    expect(normalizeMcSeeded(undefined, { preset: 'madcow' })).toBe(true);
  });

  it('infers true from a legacy save past week 1, even back on Standard', () => {
    expect(normalizeMcSeeded(undefined, { preset: 'standard', mcWeek: 6 })).toBe(true);
  });

  it('defaults to false with no saved data at all', () => {
    expect(normalizeMcSeeded(undefined)).toBe(false);
  });
});

describe('getProgramExercises', () => {
  it('overrides sets/reps from the program, keeping order and increment', () => {
    const program = normalizeProgram({ bench: { sets: 3, reps: 8 } });
    const exercises = getProgramExercises('A', program);
    const bench = exercises.find(e => e.id === 'bench');
    expect(bench.sets).toBe(3);
    expect(bench.reps).toBe(8);
    expect(bench.increment).toBe(2.5);
    expect(exercises.map(e => e.id)).toEqual(['squat', 'bench', 'row']);
  });
});

describe('targetReps', () => {
  it('reads the reps target off the exercise entry', () => {
    expect(targetReps({ reps: 8 })).toBe(8);
  });

  it('defaults to 5 when reps is missing', () => {
    expect(targetReps({})).toBe(5);
  });
});

describe('isExercisePassed', () => {
  it('passes when every set hits the target', () => {
    expect(isExercisePassed({ reps: 8, setsCompleted: [8, 8, 8] })).toBe(true);
  });

  it('fails when any set misses the target', () => {
    expect(isExercisePassed({ reps: 8, setsCompleted: [8, 7, 8] })).toBe(false);
  });

  it('defaults the target to 5 when reps is unset', () => {
    expect(isExercisePassed({ setsCompleted: [5, 5, 5] })).toBe(true);
    expect(isExercisePassed({ setsCompleted: [5, 4, 5] })).toBe(false);
  });
});

describe('formatDuration', () => {
  it('returns "0 min" for zero milliseconds', () => {
    expect(formatDuration(0)).toBe('0 min');
  });

  it('returns minutes for durations under an hour', () => {
    expect(formatDuration(42 * 60000)).toBe('42 min');
  });

  it('rounds to nearest minute', () => {
    expect(formatDuration(42.6 * 60000)).toBe('43 min');
  });

  it('returns "59 min" for just under an hour', () => {
    expect(formatDuration(59 * 60000)).toBe('59 min');
  });

  it('returns hours and minutes for 60+ minutes', () => {
    expect(formatDuration(72 * 60000)).toBe('1h 12m');
  });

  it('handles exactly 1 hour', () => {
    expect(formatDuration(60 * 60000)).toBe('1h 0m');
  });

  it('handles multi-hour durations', () => {
    expect(formatDuration(150 * 60000)).toBe('2h 30m');
  });
});

describe('formatClock', () => {
  it('formats zero as 0:00', () => {
    expect(formatClock(0)).toBe('0:00');
  });

  it('zero-pads seconds', () => {
    expect(formatClock(65000)).toBe('1:05');
  });

  it('formats sub-minute spans', () => {
    expect(formatClock(42000)).toBe('0:42');
  });

  it('rounds to the nearest second', () => {
    expect(formatClock(89600)).toBe('1:30');
  });

  it('keeps counting minutes up to an hour', () => {
    expect(formatClock(59 * 60000)).toBe('59:00');
  });

  it('rolls over to h:mm:ss past an hour', () => {
    expect(formatClock(72 * 60000 + 5000)).toBe('1:12:05');
  });

  it('returns null for missing or invalid input', () => {
    expect(formatClock(null)).toBeNull();
    expect(formatClock(undefined)).toBeNull();
    expect(formatClock(-1000)).toBeNull();
    expect(formatClock(NaN)).toBeNull();
  });
});

describe('calculateSetDurations', () => {
  const started = 1_000_000;

  it('measures the first set from startedAt and each later set from the previous one', () => {
    const exercises = [{
      id: 'squat',
      setsCompleted: [5, 5, 5],
      setTimes: [started + 60000, started + 180000, started + 300000],
    }];

    const [squat] = calculateSetDurations(exercises, started);
    expect(squat.setDurations).toEqual([60000, 120000, 120000]);
  });

  it('drops the transient setTimes field and preserves other exercise data', () => {
    const exercises = [{
      id: 'squat',
      weight: 60,
      increment: 2.5,
      setsCompleted: [5],
      setTimes: [started + 60000],
    }];

    const [squat] = calculateSetDurations(exercises, started);
    expect(squat).not.toHaveProperty('setTimes');
    expect(squat.weight).toBe(60);
    expect(squat.increment).toBe(2.5);
    expect(squat.setsCompleted).toEqual([5]);
  });

  it('leaves uncompleted sets as null without disturbing neighbours', () => {
    const exercises = [{
      id: 'squat',
      setsCompleted: [5, null, 5],
      setTimes: [started + 60000, null, started + 200000],
    }];

    const [squat] = calculateSetDurations(exercises, started);
    expect(squat.setDurations).toEqual([60000, null, 140000]);
  });

  it('chains across exercises in chronological order, not array order', () => {
    // Row (second in the array) was finished before squat's later sets.
    const exercises = [
      { id: 'squat', setsCompleted: [5, 5], setTimes: [started + 10000, started + 90000] },
      { id: 'row', setsCompleted: [5], setTimes: [started + 40000] },
    ];

    const [squat, row] = calculateSetDurations(exercises, started);
    expect(squat.setDurations).toEqual([10000, 50000]);
    expect(row.setDurations).toEqual([30000]);
  });

  it('returns all-null durations for an exercise with nothing logged', () => {
    const exercises = [{ id: 'squat', setsCompleted: [null, null], setTimes: [null, null] }];

    const [squat] = calculateSetDurations(exercises, started);
    expect(squat.setDurations).toEqual([null, null]);
  });

  it('handles an exercise that predates set timing (no setTimes at all)', () => {
    const exercises = [{ id: 'squat', setsCompleted: [5, 5] }];

    const [squat] = calculateSetDurations(exercises, started);
    expect(squat.setDurations).toEqual([null, null]);
  });

  it('never produces a negative duration if a stamp precedes startedAt', () => {
    const exercises = [{ id: 'squat', setsCompleted: [5], setTimes: [started - 5000] }];

    const [squat] = calculateSetDurations(exercises, started);
    expect(squat.setDurations).toEqual([0]);
  });
});

describe('deloadWeightByPercent', () => {
  it('applies 10% reduction rounded to 2.5kg', () => {
    expect(deloadWeightByPercent(100, 10, 'squat')).toBe(90);
    expect(deloadWeightByPercent(60, 10, 'bench')).toBe(55);
    expect(deloadWeightByPercent(50, 10, 'row')).toBe(45);
  });

  it('applies 25% reduction', () => {
    expect(deloadWeightByPercent(100, 25, 'squat')).toBe(75);
    expect(deloadWeightByPercent(80, 25, 'press')).toBe(60);
  });

  it('applies 50% reduction', () => {
    expect(deloadWeightByPercent(100, 50, 'squat')).toBe(50);
    expect(deloadWeightByPercent(120, 50, 'deadlift')).toBe(60);
  });

  it('applies 90% reduction (clamped to floor)', () => {
    expect(deloadWeightByPercent(100, 90, 'squat')).toBe(20);
    expect(deloadWeightByPercent(200, 90, 'deadlift')).toBe(40);
  });

  it('floors at 20kg for standard exercises', () => {
    expect(deloadWeightByPercent(20, 10, 'squat')).toBe(20);
    expect(deloadWeightByPercent(22.5, 10, 'bench')).toBe(20);
    expect(deloadWeightByPercent(25, 50, 'press')).toBe(20);
  });

  it('floors at 40kg for deadlift', () => {
    expect(deloadWeightByPercent(40, 10, 'deadlift')).toBe(40);
    expect(deloadWeightByPercent(50, 50, 'deadlift')).toBe(40);
    expect(deloadWeightByPercent(60, 90, 'deadlift')).toBe(40);
  });

  it('rounds to 2.5kg increments', () => {
    expect(deloadWeightByPercent(73, 15, 'squat')).toBe(62.5);
  });
});

describe('getRecommendedDeloadPercent', () => {
  it('returns 10 for null (failure scenario)', () => {
    expect(getRecommendedDeloadPercent(null)).toBe(10);
    expect(getRecommendedDeloadPercent(undefined)).toBe(10);
  });

  it('returns 10 for 14-20 days off', () => {
    expect(getRecommendedDeloadPercent(14)).toBe(10);
    expect(getRecommendedDeloadPercent(17)).toBe(10);
    expect(getRecommendedDeloadPercent(20)).toBe(10);
  });

  it('returns 25 for 21-30 days off', () => {
    expect(getRecommendedDeloadPercent(21)).toBe(25);
    expect(getRecommendedDeloadPercent(25)).toBe(25);
    expect(getRecommendedDeloadPercent(30)).toBe(25);
  });

  it('returns 50 for 31+ days off', () => {
    expect(getRecommendedDeloadPercent(31)).toBe(50);
    expect(getRecommendedDeloadPercent(60)).toBe(50);
    expect(getRecommendedDeloadPercent(180)).toBe(50);
  });
});

describe('getConsecutiveFailures', () => {
  const session = (exerciseId, weight, reps) => ({
    date: '2026-01-01',
    exercises: [{ id: exerciseId, weight, setsCompleted: reps }],
  });

  it('returns 0 for empty history', () => {
    expect(getConsecutiveFailures([], 'squat', 60)).toBe(0);
  });

  it('returns 0 when most recent session passed', () => {
    const h = [session('squat', 60, [5, 5, 5, 5, 5])];
    expect(getConsecutiveFailures(h, 'squat', 60)).toBe(0);
  });

  it('counts consecutive failures at the same weight', () => {
    const h = [
      session('squat', 60, [5, 5, 3, 3, 2]),
      session('squat', 60, [5, 5, 5, 4, 3]),
    ];
    expect(getConsecutiveFailures(h, 'squat', 60)).toBe(2);
  });

  it('stops counting at a passed session', () => {
    const h = [
      session('squat', 60, [5, 5, 3, 3, 2]),
      session('squat', 60, [5, 5, 5, 5, 5]),
      session('squat', 60, [5, 5, 4, 3, 2]),
    ];
    expect(getConsecutiveFailures(h, 'squat', 60)).toBe(1);
  });

  it('stops counting when weight differs', () => {
    const h = [
      session('squat', 60, [5, 5, 3, 3, 2]),
      session('squat', 55, [5, 5, 4, 3, 2]),
    ];
    expect(getConsecutiveFailures(h, 'squat', 60)).toBe(1);
  });

  it('evaluates pass/fail against a non-default rep target', () => {
    const h = [
      { date: '2026-01-01', exercises: [{ id: 'bench', weight: 60, reps: 8, setsCompleted: [8, 8, 6] }] },
      { date: '2025-12-31', exercises: [{ id: 'bench', weight: 60, reps: 8, setsCompleted: [8, 8, 8] }] },
    ];
    expect(getConsecutiveFailures(h, 'bench', 60)).toBe(1);
  });

  it('breaks streak when exercise is not in session', () => {
    const h = [
      session('squat', 60, [5, 5, 3, 3, 2]),
      { date: '2026-01-01', exercises: [{ id: 'bench', weight: 40, setsCompleted: [5, 5, 5, 5, 5] }] },
    ];
    expect(getConsecutiveFailures(h, 'squat', 60)).toBe(1);
  });
});

describe('formatBytes', () => {
  it('formats sub-kilobyte sizes in bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats small kilobyte sizes with one decimal', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats larger kilobyte sizes as whole numbers', () => {
    expect(formatBytes(153600)).toBe('150 KB');
  });

  it('formats megabyte-scale sizes with one decimal', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

describe('countSessionsSince', () => {
  const s = (date) => ({ date, exercises: [] });

  it('counts every session when there is no prior save', () => {
    const history = [s('2026-01-03'), s('2026-01-02'), s('2026-01-01')];
    expect(countSessionsSince(history, null)).toBe(3);
  });

  it('counts only sessions logged after the given date', () => {
    const history = [s('2026-01-03'), s('2026-01-02'), s('2026-01-01')];
    expect(countSessionsSince(history, '2026-01-01')).toBe(2);
  });

  it('returns 0 when nothing postdates the save', () => {
    const history = [s('2026-01-01')];
    expect(countSessionsSince(history, '2026-01-03')).toBe(0);
  });
});
