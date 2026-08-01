import { SCHEMA_VERSION, EXPECTED_WEIGHT_KEYS, INITIAL_WEIGHTS, WORKOUTS, DEFAULT_PROGRAM, MIN_SETS, MAX_SETS, MIN_REPS, MAX_REPS } from './constants';

export function migrate(data, fromVersion) {
  let current = { ...data };
  if (fromVersion < 2) { current.program = normalizeProgram(current.program); }
  current.version = SCHEMA_VERSION;
  return current;
}

// Coerces/clamps a program object to valid per-exercise sets/reps, falling back to
// DEFAULT_PROGRAM for any exercise that's missing or invalid. Single choke point used
// on load, import, migration, and cross-tab sync so a corrupt value can never leak in.
export function normalizeProgram(raw) {
  const result = {};
  for (const id of EXPECTED_WEIGHT_KEYS) {
    const entry = raw && typeof raw === 'object' ? raw[id] : null;
    const fallback = DEFAULT_PROGRAM[id];
    const sets = Number.isFinite(entry?.sets) ? Math.round(entry.sets) : fallback.sets;
    const reps = Number.isFinite(entry?.reps) ? Math.round(entry.reps) : fallback.reps;
    result[id] = {
      sets: Math.min(MAX_SETS, Math.max(MIN_SETS, sets)),
      reps: Math.min(MAX_REPS, Math.max(MIN_REPS, reps)),
    };
  }
  return result;
}

// WORKOUTS[type].exercises with sets/reps overridden by the user's program.
export function getProgramExercises(type, program) {
  return WORKOUTS[type].exercises.map(ex => ({
    ...ex,
    sets: program?.[ex.id]?.sets ?? ex.sets,
    reps: program?.[ex.id]?.reps ?? ex.reps,
  }));
}

// The rep target a given exercise entry was performed against. Read off the entry
// itself (never the live program) so past history keeps the target it was set for.
export function targetReps(ex) {
  return ex?.reps ?? 5;
}

export function isExercisePassed(ex) {
  const target = targetReps(ex);
  return ex.setsCompleted.every(r => r === target);
}

export function validateImportData(d) {
  if (!d || typeof d !== 'object') return null;

  if (!d.weights || typeof d.weights !== 'object') return null;
  for (const key of EXPECTED_WEIGHT_KEYS) {
    if (typeof d.weights[key] !== 'number') return null;
  }

  if (!Array.isArray(d.history)) return null;

  const normalizedWeights = {};
  for (const key of EXPECTED_WEIGHT_KEYS) {
    normalizedWeights[key] = Math.round(d.weights[key] / 2.5) * 2.5;
  }

  const validHistory = d.history.filter(entry =>
    entry && typeof entry === 'object' &&
    typeof entry.date === 'string' &&
    typeof entry.type === 'string' &&
    Array.isArray(entry.exercises)
  );

  return { ...d, weights: normalizedWeights, history: validHistory, program: normalizeProgram(d.program) };
}

export function calculate1RM(weight, reps) {
  return (!reps || reps <= 0) ? weight : Math.round(weight * (1 + reps / 30));
}

export function calculateBest1RM(history, exerciseId) {
  let best = 0;
  for (const session of history) {
    for (const ex of session.exercises) {
      if (ex.id !== exerciseId) continue;
      for (const reps of ex.setsCompleted) {
        if (reps === null || reps <= 0) continue;
        const est = calculate1RM(ex.weight, reps);
        if (est > best) best = est;
      }
    }
  }
  return best;
}

export function calculatePlates(totalWeight) {
  if (!totalWeight || totalWeight <= 20) return [];
  let side = (totalWeight - 20) / 2;
  const res = [];
  for (const p of [25, 20, 15, 10, 5, 2.5, 1.25]) {
    while (side >= p) { res.push(p); side -= p; }
  }
  return res;
}

export function calculateWarmup(workingWeight) {
  return Math.max(20, Math.round(workingWeight * 0.6 / 2.5) * 2.5);
}

export function deloadWeightByPercent(weight, percent, exerciseId) {
  const floor = INITIAL_WEIGHTS[exerciseId] ?? 20;
  return Math.max(floor, Math.round((weight * (1 - percent / 100)) / 2.5) * 2.5);
}

export function calculateDeload(weights, percent = 10) {
  const newW = {};
  for (const id of Object.keys(weights)) {
    newW[id] = deloadWeightByPercent(weights[id], percent, id);
  }
  return newW;
}

export function getRecommendedDeloadPercent(daysOff) {
  if (daysOff == null) return 10;
  if (daysOff <= 20) return 10;
  if (daysOff <= 30) return 25;
  return 50;
}

export function getConsecutiveFailures(history, exerciseId, weight) {
  let count = 0;
  for (const session of history) {
    const ex = session.exercises?.find(e => e.id === exerciseId);
    if (!ex || ex.weight !== weight) break;
    if (isExercisePassed(ex)) break;
    count++;
  }
  return count;
}

export function formatDuration(ms, t) {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return t ? t('duration.minutes', { value: totalMinutes }) : `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return t ? t('duration.hoursMinutes', { h: hours, m: mins }) : `${hours}h ${mins}m`;
}

// Clock-style m:ss (or h:mm:ss past an hour) for short spans where formatDuration's
// whole-minute rounding would collapse everything to the same value.
export function formatClock(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}:${String(seconds).padStart(2, '0')}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Turns the transient per-set completion timestamps recorded during a workout into
// elapsed durations. A set's duration is the gap since the previously completed set
// (rest + lifting); the earliest one measures from startedAt. Timestamps are sorted
// chronologically rather than walked in array order so that finishing exercises out
// of order still yields sane splits. Sets never completed stay null.
export function calculateSetDurations(exercises, startedAt) {
  const stamps = [];
  exercises.forEach((ex, exIdx) => {
    (ex.setTimes || []).forEach((at, setIdx) => {
      if (typeof at === 'number' && Number.isFinite(at)) stamps.push({ exIdx, setIdx, at });
    });
  });
  stamps.sort((a, b) => a.at - b.at);

  const durations = new Map();
  let previous = startedAt;
  for (const stamp of stamps) {
    const elapsed = typeof previous === 'number' ? Math.max(0, stamp.at - previous) : null;
    durations.set(`${stamp.exIdx}:${stamp.setIdx}`, elapsed);
    previous = stamp.at;
  }

  return exercises.map((ex, exIdx) => {
    const { setTimes, ...rest } = ex;
    return {
      ...rest,
      setDurations: ex.setsCompleted.map((_, setIdx) => durations.get(`${exIdx}:${setIdx}`) ?? null),
    };
  });
}
