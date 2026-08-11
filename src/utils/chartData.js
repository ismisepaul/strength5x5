import { calculate1RM, targetReps, roundWeight } from '../utils';
import { topWeightOf, getProgram } from '../programs';

function bestRepsFor(ex) {
  let best = 0;
  for (const r of ex.setsCompleted) {
    if (r !== null && r > best) best = r;
  }
  return best;
}

// Total kg moved in a session. Ramped lifts (Madcow) log a per-set weight in
// setWeights; everything else is one flat weight across all sets.
export function sessionTonnage(session) {
  return session.exercises.reduce((total, ex) => {
    const reps = ex.setsCompleted || [];
    if (Array.isArray(ex.setWeights)) {
      return total + reps.reduce((sum, r, i) => sum + (typeof r === 'number' ? r * (ex.setWeights[i] ?? ex.weight) : 0), 0);
    }
    const totalReps = reps.reduce((sum, r) => sum + (typeof r === 'number' ? r : 0), 0);
    return total + ex.weight * totalReps;
  }, 0);
}

// Session counts bucketed by calendar month (index 0-11) -- the Year view's
// twelve-month bar strip. Callers pass one year's worth of sessions (e.g. a
// groupHistory('year', ...) band's entries) so the buckets mean something.
export function monthlySessionCounts(sessions) {
  const counts = new Array(12).fill(0);
  for (const s of sessions) {
    counts[new Date(s.date).getMonth()]++;
  }
  return counts;
}

// Shared by the Stats list (sparklines) and the detail chart, so both read the same
// range -- picking a range in one place keeps it selected everywhere else that shows one.
export const STATS_RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: null },
];

function rangeCutoffDate(rangeLabel) {
  const rangeDef = STATS_RANGES.find(r => r.label === rangeLabel);
  if (!rangeDef?.days) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDef.days);
  return cutoff;
}

export function filterByRange(timeline, rangeLabel) {
  const cutoff = rangeCutoffDate(rangeLabel);
  if (!cutoff) return timeline;
  return timeline.filter(p => new Date(p.date) >= cutoff);
}

// Best single set, total volume, and missed-rep count for one lift within a range --
// unlike the timeline builders above, this reads every set directly (not just the
// per-session weight/e1rm reduction), since "best set" and "misses" need per-set detail.
export function getExerciseRangeStats(history, exerciseId, rangeLabel) {
  const cutoff = rangeCutoffDate(rangeLabel);
  let bestSet = null;
  let volume = 0;
  let misses = 0;

  for (const session of history) {
    if (cutoff && new Date(session.date) < cutoff) continue;
    const ex = session.exercises.find(e => e.id === exerciseId);
    if (!ex) continue;
    const isRamped = Array.isArray(ex.setWeights);

    ex.setsCompleted.forEach((reps, i) => {
      if (reps === null) return;
      const weight = isRamped ? (ex.setWeights[i] ?? ex.weight) : ex.weight;
      volume += weight * reps;
      if (!bestSet || weight > bestSet.weight || (weight === bestSet.weight && reps > bestSet.reps)) {
        bestSet = { weight, reps };
      }
      if (reps < targetReps(ex, i)) misses++;
    });
  }

  return { bestSet, volume, misses };
}

// Big-3 volume within a range -- unlike getExerciseRangeStats, this sums across all
// three lifts rather than one, since "best set" and "misses" don't mean anything
// summed across different lifts but total kg moved still does.
export function getBig3Volume(history, rangeLabel) {
  const cutoff = rangeCutoffDate(rangeLabel);
  let volume = 0;
  for (const session of history) {
    if (cutoff && new Date(session.date) < cutoff) continue;
    for (const ex of session.exercises) {
      if (!['squat', 'bench', 'deadlift'].includes(ex.id)) continue;
      ex.setsCompleted.forEach((reps, i) => {
        if (reps === null) return;
        volume += (Array.isArray(ex.setWeights) ? (ex.setWeights[i] ?? ex.weight) : ex.weight) * reps;
      });
    }
  }
  return volume;
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

// Change between a timeline's two most recent points -- null with fewer than two,
// 0 for "held", otherwise the signed kg delta. Takes an already-built timeline
// (buildExerciseTimeline or buildBig3Timeline output) rather than history+id so it
// works for both a single lift and the Big-3 sum.
export function getWeightDelta(timeline) {
  if (timeline.length < 2) return null;
  const last = timeline[timeline.length - 1].weight;
  const prev = timeline[timeline.length - 2].weight;
  return last - prev;
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

export function getMonStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Local calendar-date key (never UTC) -- history stores full ISO timestamps, and slicing
// those to their first 10 characters reads the UTC date, which drifts a day off local
// "today" for anyone trained in the evening in a negative UTC offset, or in the morning in
// a positive one. Every same-day comparison in this module goes through this instead.
export function localDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getWeekKey(date) {
  const mon = getMonStart(date);
  return localDateKey(mon);
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

// Mon-Sun day states for the Log week card. Every box reads off the day before it, per
// the 5a rule: a session logged makes the next day 'rest' (dim), an untrained day whose
// predecessor was also untrained is 'available' (a session you could still take), and a
// trained day is 'trained' regardless of what came before it. `trained`/`isToday` are kept
// alongside `state` for existing callers.
export function getWeekDayStates(history, now = new Date()) {
  const trainedDates = new Set(history.map(s => localDateKey(s.date)));
  const todayKey = localDateKey(now);
  const start = getMonStart(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateKey = localDateKey(d);
    const trained = trainedDates.has(dateKey);
    const prevDay = new Date(d);
    prevDay.setDate(prevDay.getDate() - 1);
    const state = trained ? 'trained' : (trainedDates.has(localDateKey(prevDay)) ? 'rest' : 'available');
    return {
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      // The visible letter is ambiguous (Tue/Thu, Sat/Sun) and carries no state -- the
      // accessible label needs the unabbreviated weekday alongside it.
      fullLabel: d.toLocaleDateString(undefined, { weekday: 'long' }),
      trained,
      isToday: dateKey === todayKey,
      state,
    };
  });
}

// What the Train screen's verdict line should say about today, checked in this priority
// order: a completed week wins even over "trained today" (so a bonus 4th session still
// reads as "week complete"), which wins over yesterday's rest-day framing, which wins over
// a plain invitation naming when you last trained.
export function getWeekVerdict(history, now = new Date()) {
  const stats = getWorkoutStats(history, now);
  if (stats.thisWeek >= 3) return { key: 'complete', done: stats.thisWeek };

  const todayKey = localDateKey(now);
  if (history.some(s => localDateKey(s.date) === todayKey)) {
    return { key: 'trainedToday', done: stats.thisWeek };
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  if (history.some(s => localDateKey(s.date) === yesterdayKey)) {
    return { key: 'rest', done: stats.thisWeek };
  }

  if (history.length === 0) return { key: 'first', done: stats.thisWeek };
  // history is newest-first (App.jsx prepends on finish), so [0] is the last session.
  return { key: 'train', done: stats.thisWeek, weekday: new Date(history[0].date).toLocaleDateString(undefined, { weekday: 'long' }) };
}

// This week's and last week's total kg moved, and the signed difference between them --
// the weekly card's accent/neutral comparison line. Uses the same Mon-Sun boundary as
// getWorkoutStats so "this week" means the same thing everywhere it's shown.
export function getWeekTonnageComparison(history, now = new Date()) {
  const thisWeekStart = getMonStart(now);
  const nextWeekStart = new Date(thisWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  let thisWeek = 0;
  let lastWeek = 0;
  for (const session of history) {
    const d = new Date(session.date);
    if (d >= thisWeekStart && d < nextWeekStart) thisWeek += sessionTonnage(session);
    else if (d >= lastWeekStart && d < thisWeekStart) lastWeek += sessionTonnage(session);
  }
  return { thisWeek: Math.round(thisWeek), lastWeek: Math.round(lastWeek), delta: Math.round(thisWeek - lastWeek) };
}

// The most recent logged occurrence(s) of a lift -- up to two, newest first. Shared by
// getLiftProgress (which wants both: the latest and the one before it) and
// getWeekLiftProjection (which only wants the latest, since its baseline is the live
// program weight, not a second logged session).
function findLoggedOccurrences(history, liftId) {
  const found = [];
  for (const session of history) {
    const ex = session.exercises.find(e => e.id === liftId);
    if (!ex) continue;
    found.push({
      weight: topWeightOf(ex),
      hadMiss: ex.setsCompleted.some((r, i) => r !== null && r < targetReps(ex, i)),
    });
    if (found.length === 2) break;
  }
  return found;
}

// Where one lift stood as of its last two logged sessions: its most recent weight, what
// it was the occurrence before that, and whether the latest session was a clean pass, a
// miss (held), or a deload (drop). Retrospective -- for "where it's headed this week",
// see getWeekLiftProjection, which uses the live program weight instead.
export function getLiftProgress(history, liftId) {
  const [current, previous] = findLoggedOccurrences(history, liftId);
  if (!current) return null;
  if (!previous) return { status: 'first', weight: current.weight };
  if (current.weight > previous.weight) return { status: 'up', from: previous.weight, to: current.weight };
  if (current.weight < previous.weight) return { status: 'deload', from: previous.weight, to: current.weight };
  return { status: current.hadMiss ? 'held' : 'flat', weight: current.weight };
}

// The day-letter sequence for a program's still-to-come sessions this week, cycling
// `prog.days` the same way both programs actually advance (Standard flips A/B on finish,
// Madcow cycles A/B/C -- see App.jsx's finishWorkout) so this doesn't duplicate either
// program's own turn-taking logic.
export function getRemainingSessionLiftIds(history, presetId, startDay, programState, now = new Date()) {
  const prog = getProgram(presetId);
  const remaining = Math.max(0, 3 - getWorkoutStats(history, now).thisWeek);
  const days = [];
  let day = startDay;
  for (let i = 0; i < remaining; i++) {
    days.push(day);
    day = prog.days[(prog.days.indexOf(day) + 1) % prog.days.length];
  }
  return days.map(d => prog.liftIds(d, programState));
}

// Each of the caller-supplied lift ids (see programAllLiftIds, which resolves Madcow's
// press slot -- this never hard-codes a fixed Big-5), paired with where it actually
// stands right now. The baseline is the *live* program weight (`weights[id]` --
// Standard's working weight, or Madcow's current top set), never the last logged
// session: history is one increment (or one weekly rollover) stale the moment a session
// finishes, and Madcow's day-to-day set weights vary by design (day B's squat rungs
// below its own top set), so comparing two logged sessions would misread an ordinary
// recovery day as a deload.
//
// Madcow's top set only moves at the weekly rollover, so within a week it doesn't climb
// at all -- every Madcow row is a flat current top set, never a projection. Standard
// rows project forward: `live + increment x n`, where `n` is how many of the week's
// remaining sessions (see getRemainingSessionLiftIds) still touch that lift. A lift with
// no sessions left this week, or one that was never logged, falls back to (or omits, if
// never logged) a plain current-weight display.
export function getWeekLiftProjection(history, { liftIds = [], weights = {}, remainingSessionLiftIds = [], ramped = false, increments = {} } = {}) {
  return liftIds
    .map(id => {
      const [latest] = findLoggedOccurrences(history, id);
      if (!latest) return null;
      const live = weights[id];
      if (typeof live !== 'number') return null;

      if (ramped) return { id, progress: { status: 'flat', weight: live } };
      if (live < latest.weight) return { id, progress: { status: 'deload', from: latest.weight, to: live } };
      if (latest.hadMiss) return { id, progress: { status: 'held', weight: live } };

      const sessions = remainingSessionLiftIds.reduce((n, ids) => n + (ids.includes(id) ? 1 : 0), 0);
      if (sessions === 0) return { id, progress: { status: 'flat', weight: live } };

      const increment = increments[id] ?? 2.5;
      return { id, progress: { status: 'up', from: latest.weight, to: roundWeight(live + increment * sessions, increment) } };
    })
    .filter(Boolean);
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
