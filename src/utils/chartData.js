import { calculate1RM } from '../utils';

function bestRepsFor(ex) {
  let best = 0;
  for (const r of ex.setsCompleted) {
    if (r !== null && r > best) best = r;
  }
  return best;
}

export function buildExerciseTimeline(history, exerciseId) {
  const points = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const session = history[i];
    for (const ex of session.exercises) {
      if (ex.id !== exerciseId) continue;
      const reps = bestRepsFor(ex);
      points.push({
        date: session.date,
        weight: ex.weight,
        e1rm: reps > 0 ? calculate1RM(ex.weight, reps) : ex.weight,
      });
    }
  }
  return points;
}

export function buildBig3Timeline(history) {
  const latest = { squat: null, bench: null, deadlift: null };
  const latest1rm = { squat: null, bench: null, deadlift: null };
  const points = [];

  for (let i = history.length - 1; i >= 0; i--) {
    const session = history[i];
    let changed = false;
    for (const ex of session.exercises) {
      if (ex.id in latest) {
        latest[ex.id] = ex.weight;
        const reps = bestRepsFor(ex);
        latest1rm[ex.id] = reps > 0 ? calculate1RM(ex.weight, reps) : ex.weight;
        changed = true;
      }
    }
    if (changed && latest.squat !== null && latest.bench !== null && latest.deadlift !== null) {
      points.push({
        date: session.date,
        weight: latest.squat + latest.bench + latest.deadlift,
        e1rm: latest1rm.squat + latest1rm.bench + latest1rm.deadlift,
      });
    }
  }
  return points;
}

export function getExerciseTrend(history, exerciseId) {
  let latest = null;
  for (const session of history) {
    for (const ex of session.exercises) {
      if (ex.id === exerciseId) {
        if (latest === null) { latest = ex.weight; }
        else {
          if (latest > ex.weight) return 'up';
          if (latest < ex.weight) return 'down';
          return 'same';
        }
      }
    }
  }
  return null;
}

export function getBig3Trend(history) {
  const occurrences = { squat: [], bench: [], deadlift: [] };
  for (const session of history) {
    for (const ex of session.exercises) {
      if (ex.id in occurrences) {
        occurrences[ex.id].push(ex.weight);
      }
    }
  }
  if (occurrences.squat.length < 2 || occurrences.bench.length < 2 || occurrences.deadlift.length < 2) return null;
  const latest = occurrences.squat[0] + occurrences.bench[0] + occurrences.deadlift[0];
  const prev = occurrences.squat[1] + occurrences.bench[1] + occurrences.deadlift[1];
  if (latest > prev) return 'up';
  if (latest < prev) return 'down';
  return 'same';
}

function getMonStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekKey(date) {
  const mon = getMonStart(date);
  return `${mon.getFullYear()}-${mon.getMonth()}-${mon.getDate()}`;
}

function countWorkoutsInWeek(history, weekKey) {
  let count = 0;
  for (const s of history) {
    if (getWeekKey(s.date) === weekKey) count++;
  }
  return count;
}

function computeStatus(thisWeek) {
  const remaining = 3 - thisWeek;
  if (remaining <= 0) return { key: 'done', count: 3, color: 'emerald' };
  if (remaining === 1) return { key: 'left', count: 1, color: 'emerald' };
  if (remaining === 2) return { key: 'left', count: 2, color: 'amber' };
  return { key: 'left', count: 3, color: 'rose' };
}

export function getWorkoutStats(history, nowOverride) {
  const now = nowOverride || new Date();
  const total = history.length;

  const currentWeekKey = getWeekKey(now);
  const thisWeek = countWorkoutsInWeek(history, currentWeekKey);

  if (total === 0) return { streak: 0, total: 0, thisWeek: 0, status: computeStatus(0) };

  let streak = 0;
  const d = new Date(getMonStart(now));

  while (true) {
    const key = getWeekKey(d);
    if (countWorkoutsInWeek(history, key) >= 3) {
      streak++;
      d.setDate(d.getDate() - 7);
    } else {
      break;
    }
  }

  const status = computeStatus(thisWeek);

  return { streak, total, thisWeek, status };
}

export function groupHistory(history, mode, skip = 0) {
  const items = history.slice(skip);
  const groupMap = {};
  const groupDates = {};

  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    const d = new Date(s.date);
    let key;
    if (mode === 'week') {
      const mon = getMonStart(d);
      const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
      key = `${mon.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (mode === 'month') {
      key = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } else {
      key = d.getFullYear().toString();
    }
    if (!(key in groupMap)) {
      groupMap[key] = [];
      groupDates[key] = d.getTime();
    }
    groupMap[key].push({ session: s, originalIndex: i + skip });
  }

  return Object.keys(groupMap)
    .sort((a, b) => groupDates[b] - groupDates[a])
    .map(key => ({ key, entries: groupMap[key] }));
}
