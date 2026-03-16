import { describe, it, expect } from 'vitest';
import { buildExerciseTimeline, buildBig3Timeline, getExerciseTrend, getBig3Trend, getSessionStats, groupHistory } from '../../utils/chartData';

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

describe('getSessionStats', () => {
  function makeSessions(dates) {
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
    const stats = getSessionStats([], now);
    expect(stats.streak).toBe(0);
    expect(stats.total).toBe(0);
    expect(stats.thisWeek).toBe(0);
    expect(stats.status).toEqual({ key: 'left', count: 3, color: 'rose' });
  });

  it('counts thisWeek sessions correctly', () => {
    const wed = new Date(2026, 2, 11, 12);
    const mon = getMonday(wed);
    const tue = new Date(mon); tue.setDate(tue.getDate() + 1);
    const lastFri = new Date(mon); lastFri.setDate(lastFri.getDate() - 3);
    const h = makeSessions([mon, tue, lastFri]);
    const stats = getSessionStats(h, wed);
    expect(stats.thisWeek).toBe(2);
    expect(stats.total).toBe(3);
  });

  it('strict streak only counts weeks with 3+ sessions', () => {
    const now = new Date(2026, 2, 11, 12);
    const thisWeekMon = getMonday(now);
    const lastWeekMon = new Date(thisWeekMon); lastWeekMon.setDate(lastWeekMon.getDate() - 7);
    const twoWeeksMon = new Date(thisWeekMon); twoWeeksMon.setDate(twoWeeksMon.getDate() - 14);

    const makeWeek = (mon) => {
      const t = new Date(mon); t.setDate(t.getDate() + 1);
      const w = new Date(mon); w.setDate(w.getDate() + 2);
      return [mon, t, w];
    };

    const h = makeSessions([
      ...makeWeek(thisWeekMon),
      ...makeWeek(lastWeekMon),
      twoWeeksMon,
    ]);
    const stats = getSessionStats(h, now);
    expect(stats.streak).toBe(2);
  });

  it('streak breaks when a week has fewer than 3 sessions', () => {
    const now = new Date(2026, 2, 11, 12);
    const thisWeekMon = getMonday(now);
    const lastWeekMon = new Date(thisWeekMon); lastWeekMon.setDate(lastWeekMon.getDate() - 7);

    const h = makeSessions([
      thisWeekMon,
      new Date(thisWeekMon.getTime() + 86400000),
      new Date(thisWeekMon.getTime() + 86400000 * 2),
      lastWeekMon,
      new Date(lastWeekMon.getTime() + 86400000),
    ]);
    const stats = getSessionStats(h, now);
    expect(stats.streak).toBe(1);
  });

  it('returns zero streak when current week has fewer than 3 sessions', () => {
    const now = new Date(2026, 2, 11, 12);
    const h = makeSessions([new Date(2026, 2, 9)]);
    const stats = getSessionStats(h, now);
    expect(stats.streak).toBe(0);
  });

  it('status shows 3 done when thisWeek >= 3', () => {
    const wed = new Date(2026, 2, 11, 12);
    const mon = getMonday(wed);
    const h = makeSessions([mon, new Date(mon.getTime() + 86400000), new Date(mon.getTime() + 86400000 * 2)]);
    const stats = getSessionStats(h, wed);
    expect(stats.status).toEqual({ key: 'done', count: 3, color: 'emerald' });
  });

  it('status shows 1 left when 2 sessions done', () => {
    const wed = new Date(2026, 2, 11, 12);
    const mon = getMonday(wed);
    const h = makeSessions([mon, new Date(mon.getTime() + 86400000)]);
    const stats = getSessionStats(h, wed);
    expect(stats.status).toEqual({ key: 'left', count: 1, color: 'emerald' });
  });

  it('status shows 2 left when 1 session done', () => {
    const wed = new Date(2026, 2, 11, 12);
    const mon = getMonday(wed);
    const h = makeSessions([mon]);
    const stats = getSessionStats(h, wed);
    expect(stats.status).toEqual({ key: 'left', count: 2, color: 'amber' });
  });

  it('status shows 3 left when 0 sessions done', () => {
    const mon = new Date(2026, 2, 9, 12);
    const stats = getSessionStats([], mon);
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
