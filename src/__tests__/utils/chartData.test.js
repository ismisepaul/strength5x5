import { describe, it, expect } from 'vitest';
import { buildExerciseTimeline, buildBig3Timeline, getExerciseTrend, getBig3Trend, getWorkoutStats, groupHistory, sessionTonnage, monthlySessionCounts, getWeightDelta, filterByRange, getExerciseRangeStats, getBig3Volume, getWeekDayStates, getWeekVerdict, getWeekTonnageComparison, getLiftProgress, getRemainingSessionLiftIds, getWeekLiftProjection } from '../../utils/chartData';

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

describe('getWorkoutStats', () => {
  function makeWorkouts(dates) {
    return dates.map(d => ({ date: new Date(d).toISOString(), exercises: [] }));
  }

  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  it('returns zeros and status for empty history', () => {
    const now = new Date(2026, 2, 9, 12); // Monday
    const stats = getWorkoutStats([], now);
    expect(stats.streak).toBe(0);
    expect(stats.total).toBe(0);
    expect(stats.thisWeek).toBe(0);
    expect(stats.status).toEqual({ key: 'left', count: 3, color: 'rose' });
  });

  it('counts thisWeek workouts correctly', () => {
    const wed = new Date(2026, 2, 11, 12);
    const mon = getMonday(wed);
    const tue = new Date(mon); tue.setDate(tue.getDate() + 1);
    const lastFri = new Date(mon); lastFri.setDate(lastFri.getDate() - 3);
    const h = makeWorkouts([mon, tue, lastFri]);
    const stats = getWorkoutStats(h, wed);
    expect(stats.thisWeek).toBe(2);
    expect(stats.total).toBe(3);
  });

  it('strict streak only counts weeks with 3+ workouts', () => {
    const now = new Date(2026, 2, 11, 12);
    const thisWeekMon = getMonday(now);
    const lastWeekMon = new Date(thisWeekMon); lastWeekMon.setDate(lastWeekMon.getDate() - 7);
    const twoWeeksMon = new Date(thisWeekMon); twoWeeksMon.setDate(twoWeeksMon.getDate() - 14);

    const makeWeek = (mon) => {
      const t = new Date(mon); t.setDate(t.getDate() + 1);
      const w = new Date(mon); w.setDate(w.getDate() + 2);
      return [mon, t, w];
    };

    const h = makeWorkouts([
      ...makeWeek(thisWeekMon),
      ...makeWeek(lastWeekMon),
      twoWeeksMon,
    ]);
    const stats = getWorkoutStats(h, now);
    expect(stats.streak).toBe(2);
  });

  it('streak breaks when a week has fewer than 3 workouts', () => {
    const now = new Date(2026, 2, 11, 12);
    const thisWeekMon = getMonday(now);
    const lastWeekMon = new Date(thisWeekMon); lastWeekMon.setDate(lastWeekMon.getDate() - 7);

    const h = makeWorkouts([
      thisWeekMon,
      new Date(thisWeekMon.getTime() + 86400000),
      new Date(thisWeekMon.getTime() + 86400000 * 2),
      lastWeekMon,
      new Date(lastWeekMon.getTime() + 86400000),
    ]);
    const stats = getWorkoutStats(h, now);
    expect(stats.streak).toBe(1);
  });

  it('returns zero streak when current week has fewer than 3 workouts', () => {
    const now = new Date(2026, 2, 11, 12);
    const h = makeWorkouts([new Date(2026, 2, 9)]);
    const stats = getWorkoutStats(h, now);
    expect(stats.streak).toBe(0);
  });

  it('status shows 3 done when thisWeek >= 3', () => {
    const wed = new Date(2026, 2, 11, 12);
    const mon = getMonday(wed);
    const h = makeWorkouts([mon, new Date(mon.getTime() + 86400000), new Date(mon.getTime() + 86400000 * 2)]);
    const stats = getWorkoutStats(h, wed);
    expect(stats.status).toEqual({ key: 'done', count: 3, color: 'emerald' });
  });

  it('status shows 1 left when 2 workouts done', () => {
    const wed = new Date(2026, 2, 11, 12);
    const mon = getMonday(wed);
    const h = makeWorkouts([mon, new Date(mon.getTime() + 86400000)]);
    const stats = getWorkoutStats(h, wed);
    expect(stats.status).toEqual({ key: 'left', count: 1, color: 'emerald' });
  });

  it('status shows 2 left when 1 workout done', () => {
    const wed = new Date(2026, 2, 11, 12);
    const mon = getMonday(wed);
    const h = makeWorkouts([mon]);
    const stats = getWorkoutStats(h, wed);
    expect(stats.status).toEqual({ key: 'left', count: 2, color: 'amber' });
  });

  it('status shows 3 left when 0 workouts done', () => {
    const mon = new Date(2026, 2, 9, 12);
    const stats = getWorkoutStats([], mon);
    expect(stats.status).toEqual({ key: 'left', count: 3, color: 'rose' });
  });

});

describe('groupHistory', () => {
  function makeSession(date, type = 'A') {
    return { date: new Date(date).toISOString(), type, exercises: [] };
  }

  it('groups all entries by month when skip=0', () => {
    const h = [
      makeSession('2026-03-15'), makeSession('2026-03-13'), makeSession('2026-03-11'),
      makeSession('2026-03-08'), makeSession('2026-02-20'), makeSession('2026-02-18'),
    ];
    const groups = groupHistory(h, 'month', 0);
    expect(groups).toHaveLength(2);
    expect(groups[0].entries).toHaveLength(4);
    expect(groups[1].entries).toHaveLength(2);
  });

  it('preserves original history index for each entry', () => {
    const h = [
      makeSession('2026-03-15'), makeSession('2026-03-13'), makeSession('2026-03-11'),
      makeSession('2026-03-08'), makeSession('2026-02-20'),
    ];
    const groups = groupHistory(h, 'month', 0);
    expect(groups[0].entries[0].originalIndex).toBe(0);
    expect(groups[0].entries[3].originalIndex).toBe(3);
    expect(groups[1].entries[0].originalIndex).toBe(4);
  });

  it('returns empty for empty history', () => {
    expect(groupHistory([], 'month', 0)).toHaveLength(0);
  });

  it('groups by year correctly', () => {
    const h = [
      makeSession('2026-03-15'), makeSession('2026-03-13'), makeSession('2026-03-11'),
      makeSession('2026-01-10'), makeSession('2025-12-20'), makeSession('2025-11-15'),
    ];
    const groups = groupHistory(h, 'year', 0);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe('2026');
    expect(groups[0].entries).toHaveLength(4);
    expect(groups[1].key).toBe('2025');
    expect(groups[1].entries).toHaveLength(2);
  });

  it('respects skip parameter', () => {
    const h = [
      makeSession('2026-03-15'), makeSession('2026-03-13'), makeSession('2026-02-20'),
    ];
    const groups = groupHistory(h, 'month', 2);
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(1);
    expect(groups[0].entries[0].originalIndex).toBe(2);
  });

  it('returns groups sorted most-recent-first regardless of insertion order', () => {
    const h = [
      makeSession('2026-02-10'),
      makeSession('2026-03-14'),
      makeSession('2026-01-05'),
      makeSession('2026-03-12'),
      makeSession('2026-02-15'),
    ];
    const weekGroups = groupHistory(h, 'week', 0);
    for (let i = 1; i < weekGroups.length; i++) {
      const prevDate = new Date(weekGroups[i - 1].entries[0].session.date).getTime();
      const currDate = new Date(weekGroups[i].entries[0].session.date).getTime();
      expect(prevDate).toBeGreaterThanOrEqual(currDate);
    }

    const monthGroups = groupHistory(h, 'month', 0);
    expect(monthGroups).toHaveLength(3);
    expect(monthGroups[0].entries[0].session.date).toContain('2026-03');
    expect(monthGroups[1].entries[0].session.date).toContain('2026-02');
    expect(monthGroups[2].entries[0].session.date).toContain('2026-01');
  });
});

describe('sessionTonnage', () => {
  it('sums weight times completed reps across a flat-weight session', () => {
    const s = session('2024-01-15', 'B', [['squat', 50, [5, 5, 5, 5, 5]], ['deadlift', 70, [5]]]);
    expect(sessionTonnage(s)).toBe(50 * 25 + 70 * 5);
  });

  it('ignores unlogged (null) sets', () => {
    const s = session('2024-01-15', 'B', [['squat', 50, [5, 5, null, null, null]]]);
    expect(sessionTonnage(s)).toBe(50 * 10);
  });

  it('uses per-set weights for ramped exercises instead of the flat weight', () => {
    const s = session('2024-01-15', 'A', [['squat', 50, [5, 5, 5, 5, 5]]]);
    s.exercises[0].setWeights = [30, 37.5, 42.5, 47.5, 50];
    expect(sessionTonnage(s)).toBe((30 + 37.5 + 42.5 + 47.5 + 50) * 5);
  });
});

describe('monthlySessionCounts', () => {
  it('buckets sessions into their calendar month', () => {
    const sessions = [
      session('2024-01-05', 'A', [['squat', 50, [5]]]),
      session('2024-01-20', 'A', [['squat', 50, [5]]]),
      session('2024-03-10', 'A', [['squat', 50, [5]]]),
    ];
    const counts = monthlySessionCounts(sessions);
    expect(counts).toHaveLength(12);
    expect(counts[0]).toBe(2);
    expect(counts[2]).toBe(1);
    expect(counts[1]).toBe(0);
  });

  it('returns all zeros for an empty year', () => {
    expect(monthlySessionCounts([])).toEqual(new Array(12).fill(0));
  });

  it('counts every session in a year with sessions in every month', () => {
    const sessions = Array.from({ length: 12 }, (_, m) => session(`2024-${String(m + 1).padStart(2, '0')}-15`, 'A', [['squat', 50, [5]]]));
    const counts = monthlySessionCounts(sessions);
    expect(counts).toEqual(new Array(12).fill(1));
  });
});

describe('getWeightDelta', () => {
  it('returns null with fewer than two points', () => {
    expect(getWeightDelta([])).toBeNull();
    expect(getWeightDelta([{ weight: 50 }])).toBeNull();
  });

  it('returns 0 when the two most recent points are held at the same weight', () => {
    expect(getWeightDelta([{ weight: 50 }, { weight: 50 }])).toBe(0);
  });

  it('returns the signed kg delta between the two most recent points', () => {
    expect(getWeightDelta([{ weight: 50 }, { weight: 52.5 }])).toBe(2.5);
    expect(getWeightDelta([{ weight: 60 }, { weight: 55 }])).toBe(-5);
  });
});

describe('filterByRange', () => {
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const timeline = [
    { date: daysAgo(400), weight: 40 },
    { date: daysAgo(200), weight: 45 },
    { date: daysAgo(60), weight: 50 },
    { date: daysAgo(5), weight: 55 },
  ];

  it('returns everything for "All"', () => {
    expect(filterByRange(timeline, 'All')).toHaveLength(4);
  });

  it('keeps only points within the last 90 days for "3M"', () => {
    const result = filterByRange(timeline, '3M');
    expect(result.map(p => p.weight)).toEqual([50, 55]);
  });

  it('keeps only points within the last 365 days for "1Y"', () => {
    const result = filterByRange(timeline, '1Y');
    expect(result.map(p => p.weight)).toEqual([45, 50, 55]);
  });

  it('falls back to the full timeline for an unknown range label', () => {
    expect(filterByRange(timeline, 'bogus')).toHaveLength(4);
  });
});

describe('getExerciseRangeStats', () => {
  const daysAgoISO = (n) => new Date(Date.now() - n * 86400000).toISOString();

  it('finds the heaviest completed set, sums volume, and counts misses', () => {
    const h = [
      session('2024-01-01', 'A', [['squat', 50, [5, 5, 5, 5, 5]]]),
      session('2024-01-08', 'A', [['squat', 55, [5, 5, 3, 3, 2]]]),
    ];
    const { bestSet, volume, misses } = getExerciseRangeStats(h, 'squat', 'All');
    expect(bestSet).toEqual({ weight: 55, reps: 5 });
    expect(volume).toBe(50 * 25 + 55 * (5 + 5 + 3 + 3 + 2));
    expect(misses).toBe(3);
  });

  it('ignores unlogged sets and lifts with no matching exercise', () => {
    const h = [
      session('2024-01-01', 'A', [['squat', 50, [5, 5, null, null, null]]]),
      session('2024-01-02', 'A', [['bench', 40, [5, 5, 5, 5, 5]]]),
    ];
    const { bestSet, volume, misses } = getExerciseRangeStats(h, 'squat', 'All');
    expect(bestSet).toEqual({ weight: 50, reps: 5 });
    expect(volume).toBe(50 * 10);
    expect(misses).toBe(0);
  });

  it('uses per-set weights for ramped lifts when picking the best set', () => {
    const h = [session('2024-01-01', 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    h[0].exercises[0].setWeights = [30, 37.5, 42.5, 47.5, 50];
    h[0].exercises[0].setReps = [5, 5, 5, 5, 5];
    const { bestSet } = getExerciseRangeStats(h, 'squat', 'All');
    expect(bestSet).toEqual({ weight: 50, reps: 5 });
  });

  it('excludes sessions before the range cutoff', () => {
    const h = [
      session(daysAgoISO(400), 'A', [['squat', 60, [5, 5, 5, 5, 5]]]),
      session(daysAgoISO(5), 'A', [['squat', 50, [5, 5, 5, 5, 5]]]),
    ];
    const { bestSet } = getExerciseRangeStats(h, 'squat', '3M');
    expect(bestSet).toEqual({ weight: 50, reps: 5 });
  });

  it('returns a null bestSet and zeroed stats when nothing matches', () => {
    expect(getExerciseRangeStats([], 'squat', 'All')).toEqual({ bestSet: null, volume: 0, misses: 0 });
  });

  it('falls back to ex.weight when a ramped setWeights entry is missing (malformed import)', () => {
    const h = [session('2024-01-01', 'A', [['squat', 50, [5, 5, 5]]])];
    h[0].exercises[0].setWeights = [30, 37.5];
    const { bestSet, volume } = getExerciseRangeStats(h, 'squat', 'All');
    expect(bestSet).toEqual({ weight: 50, reps: 5 });
    expect(volume).toBe(30 * 5 + 37.5 * 5 + 50 * 5);
  });

  it('does not count reps above target as a miss', () => {
    const h = [session('2024-01-01', 'A', [['squat', 50, [6, 5, 5, 5, 5]]])];
    const { misses } = getExerciseRangeStats(h, 'squat', 'All');
    expect(misses).toBe(0);
  });
});

describe('getBig3Volume', () => {
  it('sums volume across squat/bench/deadlift only, and falls back to ex.weight for a missing ramped setWeights entry', () => {
    const h = [session('2024-01-01', 'A', [
      ['squat', 50, [5, 5]],
      ['press', 30, [5, 5]],
    ])];
    h[0].exercises[0].setWeights = [45];
    expect(getBig3Volume(h, 'All')).toBe(45 * 5 + 50 * 5);
  });
});

describe('getWeekDayStates', () => {
  it('marks a trained day and leaves every other day neutral', () => {
    const mon = new Date(2026, 2, 9, 12); // Monday
    const tue = new Date(mon); tue.setDate(tue.getDate() + 1);
    const h = [session(tue.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    const days = getWeekDayStates(h, mon);
    expect(days).toHaveLength(7);
    expect(days[1].trained).toBe(true);
    expect(days.filter(d => d.trained)).toHaveLength(1);
  });

  it('gives today a dashed invitation state when not yet trained', () => {
    const wed = new Date(2026, 2, 11, 12);
    const days = getWeekDayStates([], wed);
    expect(days[2].isToday).toBe(true);
    expect(days[2].trained).toBe(false);
    expect(days.filter(d => d.isToday)).toHaveLength(1);
  });

  it('today reads as trained (not the dashed state) once logged', () => {
    const wed = new Date(2026, 2, 11, 12);
    const h = [session(wed.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    const days = getWeekDayStates(h, wed);
    expect(days[2].isToday).toBe(true);
    expect(days[2].trained).toBe(true);
  });

  it('reads state off the day before: trained, then rest, then available', () => {
    const mon = new Date(2026, 2, 9, 12); // Monday
    const h = [session(mon.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    const days = getWeekDayStates(h, mon);
    expect(days[0].state).toBe('trained'); // Monday: trained
    expect(days[1].state).toBe('rest'); // Tuesday: day after a trained day
    expect(days[2].state).toBe('available'); // Wednesday: untrained, predecessor also untrained
  });

  it('has Monday read Sunday of the previous week for its lookback', () => {
    const sun = new Date(2026, 2, 8, 12); // the Sunday before
    const mon = new Date(2026, 2, 9, 12);
    const h = [session(sun.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    const days = getWeekDayStates(h, mon);
    expect(days[0].state).toBe('rest');
  });
});

describe('getWeekVerdict', () => {
  it('reads "first" with no history at all', () => {
    expect(getWeekVerdict([], new Date(2026, 2, 11, 12)).key).toBe('first');
  });

  it('names the last session\'s weekday when there is history but nothing today or yesterday', () => {
    const mon = new Date(2026, 2, 9, 12);
    const h = [session(mon.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    const verdict = getWeekVerdict(h, new Date(2026, 2, 11, 12)); // Wednesday
    expect(verdict.key).toBe('train');
    expect(verdict.weekday).toBe(mon.toLocaleDateString(undefined, { weekday: 'long' }));
  });

  it('reads "rest" when yesterday was trained', () => {
    const tue = new Date(2026, 2, 10, 12);
    const h = [session(tue.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    expect(getWeekVerdict(h, new Date(2026, 2, 11, 12)).key).toBe('rest');
  });

  it('reads "trainedToday" once today is logged, ahead of the rest/train checks', () => {
    const wed = new Date(2026, 2, 11, 12);
    const h = [session(wed.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    expect(getWeekVerdict(h, wed).key).toBe('trainedToday');
  });

  it('reads "complete" once the week hits 3 sessions, even ahead of "trainedToday"', () => {
    const mon = new Date(2026, 2, 9, 12);
    const tue = new Date(2026, 2, 10, 12);
    const wed = new Date(2026, 2, 11, 12);
    const h = [mon, tue, wed].map(d => session(d.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]]));
    const verdict = getWeekVerdict(h, wed);
    expect(verdict.key).toBe('complete');
    expect(verdict.done).toBe(3);
  });
});

describe('getWeekTonnageComparison', () => {
  it('splits tonnage into this week vs last week and signs the delta', () => {
    const wed = new Date(2026, 2, 11, 12);
    const lastWeekWed = new Date(wed); lastWeekWed.setDate(lastWeekWed.getDate() - 7);
    const h = [
      session(wed.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]]), // 1250
      session(lastWeekWed.toISOString(), 'A', [['squat', 40, [5, 5, 5, 5, 5]]]), // 1000
    ];
    const cmp = getWeekTonnageComparison(h, wed);
    expect(cmp.thisWeek).toBe(1250);
    expect(cmp.lastWeek).toBe(1000);
    expect(cmp.delta).toBe(250);
  });

  it('returns zeros for a week with no sessions', () => {
    const cmp = getWeekTonnageComparison([], new Date(2026, 2, 11, 12));
    expect(cmp).toEqual({ thisWeek: 0, lastWeek: 0, delta: 0 });
  });
});

describe('getLiftProgress', () => {
  it('reports "up" with the before/after weights when the latest session increased', () => {
    const h = [
      session('2024-01-15', 'A', [['squat', 50, [5, 5, 5, 5, 5]]]),
      session('2024-01-08', 'A', [['squat', 47.5, [5, 5, 5, 5, 5]]]),
    ];
    expect(getLiftProgress(h, 'squat')).toEqual({ status: 'up', from: 47.5, to: 50 });
  });

  it('reports "deload" when the latest session dropped the weight', () => {
    const h = [
      session('2024-01-15', 'A', [['squat', 45, [5, 5, 5, 5, 5]]]),
      session('2024-01-08', 'A', [['squat', 50, [5, 5, 5, 5, 5]]]),
    ];
    expect(getLiftProgress(h, 'squat')).toEqual({ status: 'deload', from: 50, to: 45 });
  });

  it('reports "held" when the weight repeats after a missed rep', () => {
    const h = [
      session('2024-01-15', 'A', [['squat', 50, [5, 5, 5, 3, null]]]),
      session('2024-01-08', 'A', [['squat', 50, [5, 5, 5, 5, 5]]]),
    ];
    expect(getLiftProgress(h, 'squat')).toEqual({ status: 'held', weight: 50 });
  });

  it('reports "flat" when the weight repeats with no miss', () => {
    const h = [
      session('2024-01-15', 'A', [['squat', 50, [5, 5, 5, 5, 5]]]),
      session('2024-01-08', 'A', [['squat', 50, [5, 5, 5, 5, 5]]]),
    ];
    expect(getLiftProgress(h, 'squat')).toEqual({ status: 'flat', weight: 50 });
  });

  it('reports "first" with just the weight when there is only one occurrence', () => {
    const h = [session('2024-01-15', 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    expect(getLiftProgress(h, 'squat')).toEqual({ status: 'first', weight: 50 });
  });

  it('returns null when the lift was never trained', () => {
    const h = [session('2024-01-15', 'A', [['bench', 40, [5, 5, 5, 5, 5]]])];
    expect(getLiftProgress(h, 'squat')).toBeNull();
  });
});

describe('getRemainingSessionLiftIds', () => {
  it("cycles Standard's A/B day letters from the given start day for however many sessions remain", () => {
    const mon = new Date(2026, 2, 9, 12);
    const ids = getRemainingSessionLiftIds([], 'standard', 'A', {}, mon);
    expect(ids).toEqual([
      ['squat', 'bench', 'row'],
      ['squat', 'press', 'deadlift'],
      ['squat', 'bench', 'row'],
    ]);
  });

  it('shortens to however many sessions are left once some of the week is already done', () => {
    const mon = new Date(2026, 2, 9, 12);
    const h = [session(mon.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    const ids = getRemainingSessionLiftIds(h, 'standard', 'B', {}, mon);
    expect(ids).toEqual([
      ['squat', 'press', 'deadlift'],
      ['squat', 'bench', 'row'],
    ]);
  });

  it("returns nothing once the week's 3-session goal is already met", () => {
    const mon = new Date(2026, 2, 9, 12);
    const tue = new Date(2026, 2, 10, 12);
    const wed = new Date(2026, 2, 11, 12);
    const h = [mon, tue, wed].map(d => session(d.toISOString(), 'A', [['squat', 50, [5, 5, 5, 5, 5]]]));
    expect(getRemainingSessionLiftIds(h, 'standard', 'A', {}, wed)).toEqual([]);
  });

  it("cycles Madcow's A/B/C days instead of Standard's A/B", () => {
    const mon = new Date(2026, 2, 9, 12);
    const ids = getRemainingSessionLiftIds([], 'madcow', 'A', { mcPress: 'incline' }, mon);
    expect(ids).toEqual([
      ['squat', 'bench', 'row'],
      ['squat', 'incline', 'deadlift'],
      ['squat', 'bench', 'row'],
    ]);
  });
});

describe('getWeekLiftProjection', () => {
  it('returns the Big-5 in program order, skipping lifts never trained', () => {
    const h = [
      session('2024-01-15', 'B', [['squat', 50, [5, 5, 5, 5, 5]], ['deadlift', 70, [5]]]),
      session('2024-01-12', 'A', [['bench', 40, [5, 5, 5, 5, 5]]]),
    ];
    const rows = getWeekLiftProjection(h, { remainingSessionLiftIds: [] });
    expect(rows.map(r => r.id)).toEqual(['squat', 'bench', 'deadlift']);
  });

  it('projects a clean lift forward by one increment per remaining session it appears in', () => {
    const h = [session('2024-01-15', 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    const rows = getWeekLiftProjection(h, {
      remainingSessionLiftIds: [['squat', 'bench'], ['squat', 'press']],
      increments: { squat: 2.5 },
    });
    expect(rows.find(r => r.id === 'squat').progress).toEqual({ status: 'up', from: 50, to: 55 });
  });

  it('caps the projection at one increment for a ramped program regardless of sessions left', () => {
    const h = [session('2024-01-15', 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    const rows = getWeekLiftProjection(h, {
      remainingSessionLiftIds: [['squat'], ['squat'], ['squat']],
      ramped: true,
      increments: { squat: 2.5 },
    });
    expect(rows.find(r => r.id === 'squat').progress).toEqual({ status: 'up', from: 50, to: 52.5 });
  });

  it('leaves a held (missed) lift exactly as getLiftProgress reports it, never projected', () => {
    const h = [
      session('2024-01-15', 'A', [['press', 30, [5, 5, 5, 3, null]]]),
      session('2024-01-08', 'A', [['press', 30, [5, 5, 5, 5, 5]]]),
    ];
    const rows = getWeekLiftProjection(h, { remainingSessionLiftIds: [['press']], increments: { press: 2.5 } });
    expect(rows.find(r => r.id === 'press').progress).toEqual({ status: 'held', weight: 30 });
  });

  it('leaves a deloaded lift exactly as getLiftProgress reports it, never projected', () => {
    const h = [
      session('2024-01-15', 'A', [['deadlift', 77.5, [5]]]),
      session('2024-01-08', 'A', [['deadlift', 85, [5]]]),
    ];
    const rows = getWeekLiftProjection(h, { remainingSessionLiftIds: [['deadlift']], increments: { deadlift: 5 } });
    expect(rows.find(r => r.id === 'deadlift').progress).toEqual({ status: 'deload', from: 85, to: 77.5 });
  });

  it('falls back to a plain current weight once no remaining session touches the lift', () => {
    const h = [session('2024-01-15', 'A', [['squat', 50, [5, 5, 5, 5, 5]]])];
    const rows = getWeekLiftProjection(h, { remainingSessionLiftIds: [['bench']], increments: { squat: 2.5 } });
    expect(rows.find(r => r.id === 'squat').progress).toEqual({ status: 'flat', weight: 50 });
  });
});
