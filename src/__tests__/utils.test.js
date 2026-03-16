import { describe, it, expect } from 'vitest';
import {
  calculatePlates,
  calculate1RM,
  calculateBest1RM,
  calculateDeload,
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
  it('applies 10% reduction rounded to 2.5', () => {
    const w = { squat: 100, bench: 60, row: 50, press: 40, deadlift: 120 };
    const result = calculateDeload(w);
    expect(result.squat).toBe(90);   // 100*0.9=90
    expect(result.bench).toBe(55);   // 60*0.9=54 => round(54/2.5)*2.5 = 55
    expect(result.row).toBe(45);     // 50*0.9=45
    expect(result.press).toBe(35);   // 40*0.9=36 => 36/2.5=14.4 => round(14.4)=14 => 14*2.5=35
  });

  it('floors at 20kg minimum', () => {
    const w = { squat: 20, bench: 20 };
    const result = calculateDeload(w);
    expect(result.squat).toBe(20); // 20*0.9=18 => max(20, round(18/2.5)*2.5) = max(20, 17.5) = 20
    expect(result.bench).toBe(20);
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
