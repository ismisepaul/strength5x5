import { SCHEMA_VERSION, EXPECTED_WEIGHT_KEYS, INITIAL_WEIGHTS, WORKOUTS, DEFAULT_PROGRAM, MIN_SETS, MAX_SETS, MIN_REPS, MAX_REPS, EXERCISE_INCREMENTS, MADCOW_DAYS, MADCOW_DAY_LIFTS, MADCOW_ONRAMP_WEEKS, MADCOW_WEEKLY_INCREMENTS, MADCOW_PRESS_OPTIONS, MADCOW_DEFAULT_PRESS, MADCOW_INTERVAL_OPTIONS, MADCOW_DEFAULT_INTERVAL } from './constants';

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

// Total projected kg for a preview of an exercise list: per-set weight x reps when a
// ramp (setWeights/setReps) is present, else the Standard uniform weight x reps x sets.
export function computeProjectedVolume(exercises) {
  return Math.round(exercises.reduce((total, ex) => {
    if (Array.isArray(ex.setWeights) && Array.isArray(ex.setReps)) {
      return total + ex.setWeights.reduce((sum, w, i) => sum + w * (ex.setReps[i] ?? 0), 0);
    }
    return total + ex.weight * ex.reps * ex.sets;
  }, 0));
}

// Did this lift's working weight increase the last time it was logged? Used for the
// Standard Program tab's "went up last time" note.
export function wentUpLastTime(history, exerciseId, currentWeight) {
  for (const session of history) {
    const ex = session.exercises?.find(e => e.id === exerciseId);
    if (ex) return currentWeight > ex.weight;
  }
  return false;
}

// The rep target a given exercise entry was performed against. Read off the entry
// itself (never the live program) so past history keeps the target it was set for.
// Madcow's ramp days vary the target per set (a triple, a back-off eight) via
// `ex.setReps`; Standard-shaped exercises fall back to the old uniform `ex.reps`.
export function targetReps(ex, setIdx) {
  if (Array.isArray(ex?.setReps) && setIdx !== undefined) return ex.setReps[setIdx] ?? 5;
  return ex?.reps ?? 5;
}

export function isExercisePassed(ex) {
  return ex.setsCompleted.every((r, i) => r === targetReps(ex, i));
}

export function normalizePreset(raw) {
  return raw === 'madcow' ? 'madcow' : 'standard';
}

export function normalizeMcPress(raw) {
  return MADCOW_PRESS_OPTIONS.includes(raw) ? raw : MADCOW_DEFAULT_PRESS;
}

export function normalizeMcInterval(raw) {
  return MADCOW_INTERVAL_OPTIONS.includes(raw) ? raw : MADCOW_DEFAULT_INTERVAL;
}

export function normalizeMcWeek(raw) {
  return Number.isFinite(raw) && raw >= 1 ? Math.round(raw) : 1;
}

export function normalizeMcNextDay(raw) {
  return MADCOW_DAYS.includes(raw) ? raw : 'A';
}

// Mirrors every Madcow top set into `weights` too, so Stats and any Standard-shaped
// view of "the current weight" agree with Madcow's ramp -- see madcowTopsToWeights
// for the reverse direction (Madcow -> Standard).
export function applyMcTopToWeights(weights, mcTop) {
  return { ...weights, ...mcTop };
}

// ---- Madcow 5x5 programming engine ----
// A ramped heavy/light/medium week built around one weekly top set per lift, in
// contrast to Standard's flat per-session weight.

export function roundWeight(weight, increment = 2.5, floor = 20) {
  return Math.max(floor, Math.round(weight / increment) * increment);
}

export function seedInclineWeight(benchWeight) {
  return roundWeight(benchWeight * 0.8, EXERCISE_INCREMENTS.incline, INITIAL_WEIGHTS.incline);
}

// "Your current weights become your five-rep max." Carries every Standard working
// weight over 1:1 as the eventual (week-`onrampWeeks`) top set, then backs each one
// off by (onrampWeeks - 1) weekly steps so week 1 starts lighter and week `onrampWeeks`
// matches the lift's pre-switch best exactly.
export function seedMadcowTops(weights, onrampWeeks = MADCOW_ONRAMP_WEEKS) {
  const fullTop = {
    squat: weights.squat,
    bench: weights.bench,
    row: weights.row,
    deadlift: weights.deadlift,
    press: weights.press,
    incline: seedInclineWeight(weights.bench),
  };
  const seeded = {};
  for (const id of Object.keys(fullTop)) {
    const increment = MADCOW_WEEKLY_INCREMENTS[id] ?? 2.5;
    const floor = INITIAL_WEIGHTS[id] ?? 20;
    seeded[id] = roundWeight(fullTop[id] - (onrampWeeks - 1) * increment, increment, floor);
  }
  return seeded;
}

// Coerces/fills a persisted mcTop against a fresh seed, the same defend-on-load
// pattern as normalizeProgram: every expected key ends up a finite number.
export function normalizeMcTop(raw, weights) {
  const seeded = seedMadcowTops(weights);
  const result = {};
  for (const id of Object.keys(seeded)) {
    const val = raw?.[id];
    result[id] = Number.isFinite(val) ? val : seeded[id];
  }
  return result;
}

// "Each lift keeps the top set it reached on Madcow as its working weight, and every
// set goes back to the same load." Incline has no Standard slot, so it's dropped.
export function madcowTopsToWeights(weights, mcTop, mcPress) {
  return {
    ...weights,
    squat: mcTop.squat,
    bench: mcTop.bench,
    row: mcTop.row,
    deadlift: mcTop.deadlift,
    press: mcPress === 'press' ? mcTop.press : weights.press,
  };
}

export function madcowPhase(week, onrampWeeks = MADCOW_ONRAMP_WEEKS) {
  if (week < onrampWeeks) return 'onramp';
  if (week === onrampWeeks) return 'matching';
  return 'record';
}

// The i-th (1-indexed) of `count` ramp sets as a fraction of `top`, the last landing
// exactly on `top`. count=5, interval=12.5 -> 50/62.5/75/87.5/100%.
function rampFraction(index, count, intervalPercent) {
  return 1 - (count - index) * (intervalPercent / 100);
}

// Every Madcow day's sets are drawn from this same 5-rung ramp toward `top` -- see
// buildMadcowLiftPlan for how each day slices it differently.
export function computeRampWeights(top, intervalPercent, increment, floor, count = 5) {
  const weights = [];
  for (let i = 1; i <= count; i++) {
    weights.push(roundWeight(top * rampFraction(i, count, intervalPercent), increment, floor));
  }
  return weights;
}

export function buildMadcowLiftPlan(day, liftId, mcTop, intervalPercent) {
  const increment = MADCOW_WEEKLY_INCREMENTS[liftId] ?? 2.5;
  const floor = INITIAL_WEIGHTS[liftId] ?? 20;
  const top = mcTop[liftId];
  const ramp = computeRampWeights(top, intervalPercent, increment, floor);

  if (day === 'A') {
    return { id: liftId, sets: 5, setWeights: ramp, setReps: [5, 5, 5, 5, 5], weight: ramp[4], increment };
  }

  if (day === 'C') {
    const attempt = roundWeight(top + increment, increment, floor);
    const backoff = ramp[2];
    return {
      id: liftId, sets: 6,
      setWeights: [...ramp.slice(0, 4), attempt, backoff],
      setReps: [5, 5, 5, 5, 3, 8],
      weight: attempt, increment,
    };
  }

  // day === 'B': squat repeats its third (lightest-of-the-heavy) rung; the second
  // press and deadlift ramp up to their full top across four sets instead of five.
  if (liftId === 'squat') {
    return {
      id: liftId, sets: 4,
      setWeights: [ramp[0], ramp[1], ramp[2], ramp[2]],
      setReps: [5, 5, 5, 5],
      weight: ramp[2], increment,
    };
  }
  return {
    id: liftId, sets: 4,
    setWeights: ramp.slice(1),
    setReps: [5, 5, 5, 5],
    weight: ramp[4], increment,
  };
}

// Madcow's equivalent of getProgramExercises: the day's lifts with per-set ramp
// weights and rep targets baked in, ready to seed a workout session.
export function getMadcowDayExercises(day, mcTop, intervalPercent, pressId) {
  return MADCOW_DAY_LIFTS[day].map(slot => {
    const liftId = slot === 'SECOND_PRESS' ? pressId : slot;
    return buildMadcowLiftPlan(day, liftId, mcTop, intervalPercent);
  });
}

// The lift ids that appear on a given Madcow day, with the press slot resolved.
export function getMadcowDayLiftIds(day, pressId) {
  return MADCOW_DAY_LIFTS[day].map(slot => (slot === 'SECOND_PRESS' ? pressId : slot));
}

// Applies one finished Madcow session's outcome: which lifts' top sets advance, and
// whether the week rolls over. Progression is frozen during the on-ramp (weeks 1..
// onrampWeeks-1), which instead climbs on schedule at each Friday rollover; day B's
// squat never gates progression since it's the week's recovery volume, not a top set.
export function evaluateMadcowOutcome(day, exercises, mcTop, week, onrampWeeks = MADCOW_ONRAMP_WEEKS) {
  const nextTop = { ...mcTop };
  const progressions = [];
  const gated = week >= onrampWeeks;

  if (gated) {
    exercises.forEach(ex => {
      const relevant = day === 'A' || (day === 'B' && ex.id !== 'squat');
      if (!relevant || !isExercisePassed(ex)) return;
      const increment = MADCOW_WEEKLY_INCREMENTS[ex.id] ?? 2.5;
      const floor = INITIAL_WEIGHTS[ex.id] ?? 20;
      nextTop[ex.id] = roundWeight(mcTop[ex.id] + increment, increment, floor);
      progressions.push(ex.id);
    });
  }

  let nextWeek = week;
  if (day === 'C') {
    nextWeek = week + 1;
    if (week < onrampWeeks) {
      for (const id of Object.keys(nextTop)) {
        const increment = MADCOW_WEEKLY_INCREMENTS[id] ?? 2.5;
        const floor = INITIAL_WEIGHTS[id] ?? 20;
        nextTop[id] = roundWeight(nextTop[id] + increment, increment, floor);
      }
    }
  }

  return { nextTop, progressions, nextWeek };
}

// Short rest for a light ramp set, longer as the next set approaches the day's top.
export function madcowRestSeconds(nextSetWeight, dayTopWeight, preferredRest) {
  if (!dayTopWeight) return preferredRest;
  const share = nextSetWeight / dayTopWeight;
  if (share >= 0.95) return 300;
  if (share >= 0.75) return 180;
  return 90;
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
  normalizedWeights.incline = Number.isFinite(d.weights.incline)
    ? Math.round(d.weights.incline / EXERCISE_INCREMENTS.incline) * EXERCISE_INCREMENTS.incline
    : seedInclineWeight(normalizedWeights.bench);

  const validHistory = d.history
    .filter(entry =>
      entry && typeof entry === 'object' &&
      typeof entry.date === 'string' &&
      typeof entry.type === 'string' &&
      Array.isArray(entry.exercises)
    )
    .map(entry => ({ ...entry, preset: normalizePreset(entry.preset) }));

  return {
    ...d,
    weights: normalizedWeights,
    history: validHistory,
    program: normalizeProgram(d.program),
    preset: normalizePreset(d.preset),
    mcTop: normalizeMcTop(d.mcTop, normalizedWeights),
    mcWeek: normalizeMcWeek(d.mcWeek),
    mcInterval: normalizeMcInterval(d.mcInterval),
    mcPress: normalizeMcPress(d.mcPress),
    mcNextDay: normalizeMcNextDay(d.mcNextDay),
  };
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
