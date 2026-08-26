import { SCHEMA_VERSION, EXPECTED_WEIGHT_KEYS, INITIAL_WEIGHTS, WORKOUTS, DEFAULT_PROGRAM, MIN_SETS, MAX_SETS, MIN_REPS, MAX_REPS, EXERCISE_INCREMENTS, MADCOW_DAYS, MADCOW_DAY_LIFTS, MADCOW_ONRAMP_WEEKS, MADCOW_WEEKLY_INCREMENTS, MADCOW_PRESS_OPTIONS, MADCOW_DEFAULT_PRESS, MADCOW_INTERVAL_OPTIONS, MADCOW_DEFAULT_INTERVAL, PLATE_WEIGHTS, MIN_WEIGHT_INCREMENT, REST_SHORT_SECONDS, CUSTOM_REST_MAX } from './constants';

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

// Lift ids that passed Workout A's top set this week but whose bump is deferred to the
// Friday rollover (see evaluateMadcowOutcome) -- so anything else is dropped as junk.
export function normalizeMcPending(raw) {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(Object.keys(MADCOW_WEEKLY_INCREMENTS));
  return [...new Set(raw.filter(id => typeof id === 'string' && valid.has(id)))];
}

// Whether the current Madcow block has already been seeded from Standard's weights --
// switchProgramState (programSwitch.js) reads this to tell "first switch to Madcow"
// (seed the on-ramp) apart from "returning to Madcow" (resume mcTop/mcWeek as saved).
// Saves from before this field existed have no `mcSeeded` key at all, so it's inferred
// from state that could only exist after a real switch: already on Madcow, or (a saved
// preset can drift back to Standard while mcWeek stays > 1) past week 1.
export function normalizeMcSeeded(raw, saved = {}) {
  if (raw === true) return true;
  return normalizePreset(saved.preset) === 'madcow' || normalizeMcWeek(saved.mcWeek) > 1;
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

// The single choke point every displayed/stored weight passes through. No caller may
// round to a finer grid than MIN_WEIGHT_INCREMENT -- whatever `increment` it passes
// (even a stale, corrupt, or non-finite one) gets rounded onto the nearest loadable
// multiple first, so the app can never show a weight nobody could actually put on a
// bar -- or, for a genuinely broken increment (NaN, 0, negative), silently show NaN.
export function roundWeight(weight, increment = MIN_WEIGHT_INCREMENT, floor = 20) {
  const safeIncrement = Number.isFinite(increment) && increment > 0 ? increment : MIN_WEIGHT_INCREMENT;
  const step = Math.max(MIN_WEIGHT_INCREMENT, Math.round(safeIncrement / MIN_WEIGHT_INCREMENT) * MIN_WEIGHT_INCREMENT);
  return Math.max(floor, Math.round(weight / step) * step);
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
// pattern as normalizeProgram: every expected key ends up a finite number, snapped
// to the plate grid -- so a value saved before MIN_WEIGHT_INCREMENT was enforced
// (or restored from an old backup) self-heals instead of displaying forever.
export function normalizeMcTop(raw, weights) {
  const seeded = seedMadcowTops(weights);
  const result = {};
  for (const id of Object.keys(seeded)) {
    const val = raw?.[id];
    const increment = MADCOW_WEEKLY_INCREMENTS[id] ?? MIN_WEIGHT_INCREMENT;
    const floor = INITIAL_WEIGHTS[id] ?? 20;
    result[id] = Number.isFinite(val) ? roundWeight(val, increment, floor) : seeded[id];
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

// "Week 1: Starting weight. Week 2: add increment. Week 3: add another increment.
// Week 4: match your previous 5-rep max" -- the on-ramp adds one fixed increment per
// week regardless of performance (see evaluateMadcowOutcome's unconditional bump while
// `week < onrampWeeks`), so any on-ramp week's top set is knowable in advance from any
// other: just walk the fixed step the right number of times. Only valid while both
// `week` and `targetWeek` are still inside the on-ramp -- once a lift is in weekly
// (performance-gated) progression, its future top sets aren't arithmetic anymore.
export function projectOnrampMcTop(mcTop, week, targetWeek, onrampWeeks = MADCOW_ONRAMP_WEEKS) {
  if (week > onrampWeeks || targetWeek > onrampWeeks || targetWeek === week) return mcTop;
  const delta = targetWeek - week;
  const result = {};
  for (const id of Object.keys(mcTop)) {
    const increment = MADCOW_WEEKLY_INCREMENTS[id] ?? 2.5;
    const floor = INITIAL_WEIGHTS[id] ?? 20;
    result[id] = roundWeight(mcTop[id] + delta * increment, increment, floor);
  }
  return result;
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

// Rest before a set, per Stronglifts' Madcow guide: short for the first light ramp
// set, normal as sets build toward the top -- also the fixed rest before Workout C's
// 8-rep back-off set, regardless of its lighter weight -- and long only before the
// day's genuine top-effort set. Day B's squat is recovery volume and is capped at
// `build`, never reaching `top` even on its heaviest (repeated) set.
const MADCOW_REST = { ramp: 90, build: 180, top: 300 };

export function buildMadcowLiftPlan(day, liftId, mcTop, intervalPercent) {
  const increment = MADCOW_WEEKLY_INCREMENTS[liftId] ?? 2.5;
  const floor = INITIAL_WEIGHTS[liftId] ?? 20;
  const top = mcTop[liftId];
  const ramp = computeRampWeights(top, intervalPercent, increment, floor);
  const { ramp: RAMP, build: BUILD, top: TOP } = MADCOW_REST;

  if (day === 'A') {
    return {
      id: liftId, sets: 5, setWeights: ramp, setReps: [5, 5, 5, 5, 5], weight: ramp[4], increment,
      restSeconds: [0, RAMP, BUILD, BUILD, TOP],
    };
  }

  if (day === 'C') {
    const attempt = roundWeight(top + increment, increment, floor);
    const backoff = ramp[2];
    return {
      id: liftId, sets: 6,
      setWeights: [...ramp.slice(0, 4), attempt, backoff],
      setReps: [5, 5, 5, 5, 3, 8],
      weight: attempt, increment,
      restSeconds: [0, RAMP, BUILD, BUILD, TOP, BUILD],
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
      restSeconds: [0, RAMP, BUILD, BUILD],
    };
  }
  return {
    id: liftId, sets: 4,
    setWeights: ramp.slice(1),
    setReps: [5, 5, 5, 5],
    weight: ramp[4], increment,
    restSeconds: [0, BUILD, BUILD, TOP],
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
//
// `mcTop` always holds *this week's* Monday top set, never next week's -- Wednesday's
// squat ramp and Friday's `top + increment` attempt both depend on that staying true
// all week. A passed Workout A therefore can't bump `nextTop` immediately (that would
// make Wednesday/Friday read a weight nobody actually lifted yet); instead it's queued
// in `nextPending` and only applied -- alongside the week's own increment during the
// on-ramp -- at the Friday rollover. Workout B's press/deadlift bump `nextTop` directly
// since neither lift is read again before next Wednesday, so there's nothing for a
// same-week Friday to over-read.
export function evaluateMadcowOutcome(day, exercises, mcTop, week, mcPending, onrampWeeks = MADCOW_ONRAMP_WEEKS) {
  const nextTop = { ...mcTop };
  const nextPending = new Set(mcPending);
  const progressions = [];
  const gated = week >= onrampWeeks;

  if (gated) {
    exercises.forEach(ex => {
      const relevant = day === 'A' || (day === 'B' && ex.id !== 'squat');
      if (!relevant || !isExercisePassed(ex)) return;
      progressions.push(ex.id);
      if (day === 'A') {
        nextPending.add(ex.id);
      } else {
        const increment = MADCOW_WEEKLY_INCREMENTS[ex.id] ?? 2.5;
        const floor = INITIAL_WEIGHTS[ex.id] ?? 20;
        nextTop[ex.id] = roundWeight(mcTop[ex.id] + increment, increment, floor);
      }
    });
  }

  let nextWeek = week;
  if (day === 'C') {
    nextWeek = week + 1;
    for (const id of nextPending) {
      const increment = MADCOW_WEEKLY_INCREMENTS[id] ?? 2.5;
      const floor = INITIAL_WEIGHTS[id] ?? 20;
      nextTop[id] = roundWeight(nextTop[id] + increment, increment, floor);
    }
    nextPending.clear();
    if (week < onrampWeeks) {
      for (const id of Object.keys(nextTop)) {
        const increment = MADCOW_WEEKLY_INCREMENTS[id] ?? 2.5;
        const floor = INITIAL_WEIGHTS[id] ?? 20;
        nextTop[id] = roundWeight(nextTop[id] + increment, increment, floor);
      }
    }
  }

  // The weight to *show* as "progressed to" -- newly-queued lifts haven't actually
  // moved in nextTop yet (that waits for Friday), so project their eventual value for
  // display without mutating the real, still-frozen top set.
  const projectedTop = { ...nextTop };
  for (const id of nextPending) {
    if (mcPending.includes(id)) continue;
    const increment = MADCOW_WEEKLY_INCREMENTS[id] ?? 2.5;
    const floor = INITIAL_WEIGHTS[id] ?? 20;
    projectedTop[id] = roundWeight(nextTop[id] + increment, increment, floor);
  }

  return { nextTop, nextPending: [...nextPending], progressions, projectedTop, nextWeek };
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
    mcPending: normalizeMcPending(d.mcPending),
    mcSeeded: normalizeMcSeeded(d.mcSeeded, d),
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

const PLATE_WEIGHTS_DESC = [...PLATE_WEIGHTS].sort((a, b) => b - a);

export function calculatePlates(totalWeight) {
  if (!totalWeight || totalWeight <= 20) return [];
  let side = (totalWeight - 20) / 2;
  const res = [];
  for (const p of PLATE_WEIGHTS_DESC) {
    while (side >= p) { res.push(p); side -= p; }
  }
  return res;
}

export function calculateWarmup(workingWeight) {
  return roundWeight(workingWeight * 0.6);
}

// Total kg across a day's exercises, shown on Train's idle screen above Start workout.
// Works for both Standard's flat weight/sets/reps entries and Madcow's ramped
// setWeights/setReps entries, since dayExercises() from programs.js can return either.
export function plannedVolume(dayExercises) {
  return dayExercises.reduce((total, ex) => {
    if (Array.isArray(ex.setWeights)) {
      return total + ex.setWeights.reduce((sum, w, i) => sum + w * (ex.setReps[i] ?? 0), 0);
    }
    return total + ex.weight * ex.sets * ex.reps;
  }, 0);
}

export function deloadWeightByPercent(weight, percent, exerciseId) {
  const floor = INITIAL_WEIGHTS[exerciseId] ?? 20;
  return roundWeight(weight * (1 - percent / 100), MIN_WEIGHT_INCREMENT, floor);
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

// The rest timer's count-up clock: counts up to `duration` (the marker) then keeps
// going into overtime, capped at the hard CUSTOM_REST_MAX ceiling. Shared by RestTimer.jsx
// (the Train tab strip) and the cross-tab live bar in App.jsx so the two can't drift back
// out of sync with each other the way they did before both read this same formula.
export function restElapsedFromTimer({ isActive, isExpired, duration, seconds, elapsed }) {
  return Math.min(
    isActive ? Math.max(0, duration - seconds) : isExpired ? duration + elapsed : 0,
    CUSTOM_REST_MAX,
  );
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

// Set-intensity band for a rest interval -- design 4b's "guidance behind the cap"
// reference (Light 1:30-2:00, Medium 2:00-3:00, Heavy 3:00-5:00), extended down to
// REST_SHORT_SECONDS so RestIntervalControl has a band to show for anything between the
// "too short to recover" floor and the top of Light Set. Null below that floor -- there's
// nothing to name, the short-rest notice takes over instead.
export function restBand(seconds) {
  if (seconds < REST_SHORT_SECONDS) return null;
  if (seconds < 120) return 'light';
  if (seconds <= 180) return 'medium';
  return 'heavy';
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

export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// How many logged sessions postdate the last successful Drive save -- used to tell a
// lapsed Drive connection ("paused since X, N sessions unsaved") apart from one that's
// simply never been connected.
export function countSessionsSince(history, sinceDate) {
  if (!sinceDate) return history.length;
  const cutoff = new Date(sinceDate).getTime();
  if (!Number.isFinite(cutoff)) return history.length;
  return history.filter(s => new Date(s.date).getTime() > cutoff).length;
}
