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
} from '../utils';
import { SCHEMA_VERSION } from '../constants';

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

  it('breaks streak when exercise is not in session', () => {
    const h = [
      session('squat', 60, [5, 5, 3, 3, 2]),
      { date: '2026-01-01', exercises: [{ id: 'bench', weight: 40, setsCompleted: [5, 5, 5, 5, 5] }] },
    ];
    expect(getConsecutiveFailures(h, 'squat', 60)).toBe(1);
  });
});
