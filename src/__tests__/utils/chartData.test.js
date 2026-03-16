import { describe, it, expect } from 'vitest';
import { buildExerciseTimeline, buildBig3Timeline, getExerciseTrend, getBig3Trend } from '../../utils/chartData';

const session = (date, type, exercises) => ({
  date: new Date(date).toISOString(),
  type,
  exercises: exercises.map(([id, weight, setsCompleted]) => ({
    id,
    name: id,
    weight,
    sets: setsCompleted.length,
    reps: 5,
    increment: 2.5,
    setsCompleted,
  })),
});

const history = [
  session('2024-01-15', 'B', [['squat', 50, [5,5,5,5,5]], ['press', 30, [5,5,5,5,3]], ['deadlift', 70, [5]]]),
  session('2024-01-12', 'A', [['squat', 47.5, [5,5,5,5,5]], ['bench', 40, [5,5,5,5,5]], ['row', 42.5, [5,5,5,5,5]]]),
  session('2024-01-08', 'B', [['squat', 45, [5,5,5,5,5]], ['press', 27.5, [5,5,5,5,5]], ['deadlift', 65, [5]]]),
  session('2024-01-05', 'A', [['squat', 42.5, [5,5,5,5,5]], ['bench', 37.5, [5,5,5,5,5]], ['row', 40, [5,5,5,5,5]]]),
];

describe('buildExerciseTimeline', () => {
  it('returns correct weight and e1rm values sorted oldest-first', () => {
    const timeline = buildExerciseTimeline(history, 'squat');
    expect(timeline).toHaveLength(4);
    expect(timeline[0].weight).toBe(42.5);
    expect(timeline[3].weight).toBe(50);
    expect(timeline[3].e1rm).toBeGreaterThan(50);
  });

  it('returns empty array for exercise with no history', () => {
    expect(buildExerciseTimeline(history, 'nonexistent')).toEqual([]);
  });

  it('computes e1rm from best reps in the set', () => {
    const timeline = buildExerciseTimeline(history, 'press');
    expect(timeline).toHaveLength(2);
    const latest = timeline[1];
    expect(latest.weight).toBe(30);
    expect(latest.e1rm).toBe(Math.round(30 * (1 + 5 / 30)));
  });

  it('timeline is sorted oldest-first', () => {
    const timeline = buildExerciseTimeline(history, 'squat');
    for (let i = 1; i < timeline.length; i++) {
      expect(new Date(timeline[i].date).getTime()).toBeGreaterThanOrEqual(new Date(timeline[i - 1].date).getTime());
    }
  });
});

describe('buildBig3Timeline', () => {
  it('sums squat + bench + deadlift correctly', () => {
    const timeline = buildBig3Timeline(history);
    expect(timeline.length).toBeGreaterThan(0);
    const latest = timeline[timeline.length - 1];
    expect(latest.weight).toBe(50 + 40 + 70);
  });

  it('only produces points once all three lifts have appeared', () => {
    const shortHistory = [
      session('2024-01-05', 'A', [['squat', 40, [5,5,5,5,5]], ['bench', 30, [5,5,5,5,5]], ['row', 35, [5,5,5,5,5]]]),
    ];
    const timeline = buildBig3Timeline(shortHistory);
    expect(timeline).toHaveLength(0);
  });

  it('timeline is sorted oldest-first', () => {
    const timeline = buildBig3Timeline(history);
    for (let i = 1; i < timeline.length; i++) {
      expect(new Date(timeline[i].date).getTime()).toBeGreaterThanOrEqual(new Date(timeline[i - 1].date).getTime());
    }
  });
});

describe('getExerciseTrend', () => {
  it('returns up when latest session weight exceeds the previous session', () => {
    expect(getExerciseTrend(history, 'squat')).toBe('up');
  });

  it('returns down when latest session weight is below the previous session', () => {
    const downHistory = [
      session('2024-01-15', 'A', [['squat', 40, [5,5,5,5,5]]]),
      session('2024-01-12', 'A', [['squat', 45, [5,5,5,5,5]]]),
    ];
    expect(getExerciseTrend(downHistory, 'squat')).toBe('down');
  });

  it('returns same when last two sessions have equal weight', () => {
    const sameHistory = [
      session('2024-01-15', 'A', [['squat', 50, [5,5,5,5,5]]]),
      session('2024-01-12', 'A', [['squat', 50, [5,5,5,5,5]]]),
    ];
    expect(getExerciseTrend(sameHistory, 'squat')).toBe('same');
  });

  it('returns null when exercise has fewer than 2 sessions', () => {
    const single = [
      session('2024-01-15', 'A', [['squat', 50, [5,5,5,5,5]]]),
    ];
    expect(getExerciseTrend(single, 'squat')).toBeNull();
  });

  it('returns null when exercise has no history', () => {
    expect(getExerciseTrend(history, 'nonexistent')).toBeNull();
  });

  it('compares history entries not current weights to avoid always-up bug', () => {
    const h = [
      session('2024-01-15', 'A', [['bench', 40, [5,5,5,5,5]]]),
      session('2024-01-12', 'A', [['bench', 40, [5,5,5,5,5]]]),
    ];
    expect(getExerciseTrend(h, 'bench')).toBe('same');
  });
});

describe('getBig3Trend', () => {
  it('returns up when latest big3 total exceeds previous', () => {
    expect(getBig3Trend(history)).toBe('up');
  });

  it('returns down when latest big3 total is below previous', () => {
    const downHistory = [
      session('2024-01-15', 'B', [['squat', 40, [5,5,5,5,5]], ['press', 30, [5,5,5,5,5]], ['deadlift', 55, [5]]]),
      session('2024-01-12', 'A', [['squat', 45, [5,5,5,5,5]], ['bench', 42.5, [5,5,5,5,5]], ['row', 40, [5,5,5,5,5]]]),
      session('2024-01-08', 'B', [['squat', 45, [5,5,5,5,5]], ['press', 30, [5,5,5,5,5]], ['deadlift', 65, [5]]]),
      session('2024-01-05', 'A', [['squat', 42.5, [5,5,5,5,5]], ['bench', 42.5, [5,5,5,5,5]], ['row', 40, [5,5,5,5,5]]]),
    ];
    expect(getBig3Trend(downHistory)).toBe('down');
  });

  it('returns same when big3 totals match', () => {
    const sameHistory = [
      session('2024-01-15', 'B', [['squat', 50, [5,5,5,5,5]], ['press', 30, [5,5,5,5,5]], ['deadlift', 70, [5]]]),
      session('2024-01-12', 'A', [['squat', 50, [5,5,5,5,5]], ['bench', 40, [5,5,5,5,5]], ['row', 40, [5,5,5,5,5]]]),
      session('2024-01-08', 'B', [['squat', 50, [5,5,5,5,5]], ['press', 30, [5,5,5,5,5]], ['deadlift', 70, [5]]]),
      session('2024-01-05', 'A', [['squat', 50, [5,5,5,5,5]], ['bench', 40, [5,5,5,5,5]], ['row', 40, [5,5,5,5,5]]]),
    ];
    expect(getBig3Trend(sameHistory)).toBe('same');
  });

  it('returns null when not all three lifts have two sessions', () => {
    const partial = [
      session('2024-01-05', 'A', [['squat', 40, [5,5,5,5,5]], ['bench', 30, [5,5,5,5,5]], ['row', 35, [5,5,5,5,5]]]),
    ];
    expect(getBig3Trend(partial)).toBeNull();
  });
});
