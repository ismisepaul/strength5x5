import { WORKOUTS, INITIAL_WEIGHTS } from './constants';
import { isExercisePassed, getConsecutiveFailures, getRecommendedDeloadPercent, roundWeight } from './utils';
import { getProgram } from './programs';

// Standard-program progression: +increment on every exercise that hit its full rep
// target, or flags a pending deload once a failed exercise has stalled at the same
// weight for 2+ prior sessions. Madcow has its own outcome logic in madcow.js --
// this only runs for the Standard program (see App.jsx's finishWorkout).
export const evaluateWorkoutOutcome = (workout, priorHistory, baseWeights) => {
  const nextWeights = { ...baseWeights };
  const progressions = [];
  const pendingDeloads = [];

  workout.exercises.forEach(ex => {
    const passed = isExercisePassed(ex);
    const defaultIncrement = ex.id === 'deadlift' ? 5 : 2.5;
    const increment = ex.increment
      ?? WORKOUTS[workout.type]?.exercises.find(e => e.id === ex.id)?.increment
      ?? defaultIncrement;

    if (passed) {
      nextWeights[ex.id] = roundWeight(ex.weight + increment, increment, INITIAL_WEIGHTS[ex.id] ?? 20);
      progressions.push(ex.id);
    } else {
      const priorFailures = getConsecutiveFailures(priorHistory, ex.id, ex.weight);
      if (priorFailures >= 2) {
        pendingDeloads.push({ id: ex.id, currentWeight: ex.weight });
      }
    }
  });

  return { nextWeights, progressions, pendingDeloads };
};

// Scans every exercise across both workout days for a 3+ consecutive failure streak
// at its most recently logged weight, so a start-of-workout deload prompt can catch a
// stall that built up before the user opened the app again (not just the one exercise
// they're about to lift).
export const getPendingFailureDeloadsForStart = (historyToCheck, workoutWeights) => {
  const exercises = Object.values(WORKOUTS)
    .flatMap(workout => workout.exercises)
    .filter((exercise, index, arr) => arr.findIndex(e => e.id === exercise.id) === index);
  const getLatestFailureStreak = (exerciseId) => {
    const latestSessionWithExercise = historyToCheck.find(session => session.exercises?.some(e => e.id === exerciseId));
    const latestExercise = latestSessionWithExercise?.exercises?.find(e => e.id === exerciseId);
    if (!latestExercise) return { streakWeight: null, consecutiveFailures: 0 };
    const streakWeight = latestExercise.weight;
    return {
      streakWeight,
      consecutiveFailures: getConsecutiveFailures(historyToCheck, exerciseId, streakWeight),
    };
  };
  const diagnostics = exercises.map(ex => {
    const streak = getLatestFailureStreak(ex.id);
    return {
      id: ex.id,
      plannedWeight: workoutWeights[ex.id],
      streakWeight: streak.streakWeight,
      consecutiveFailures: streak.consecutiveFailures,
    };
  });
  const pending = diagnostics
    .filter(ex => ex.consecutiveFailures >= 3)
    .map(ex => ({ id: ex.id, currentWeight: ex.plannedWeight }));
  return pending;
};

// The one start-of-workout gate: long-break deload takes precedence over a failure
// deload, and Madcow only ever sees the long-break check (its "stall" is the top set
// holding, handled by evaluateMadcowOutcome instead -- see docs/architecture.md).
export const getStartDeloadPrompt = (historyToCheck, workoutWeights, { longBreakDeloadForDate, preset }) => {
  if (historyToCheck.length === 0) return null;

  const lastWorkoutDate = historyToCheck[0].date;
  const last = new Date(lastWorkoutDate);
  const daysOff = Math.floor((new Date() - last) / 86400000);
  if (daysOff >= 14 && longBreakDeloadForDate !== lastWorkoutDate) {
    const recommended = getRecommendedDeloadPercent(daysOff);
    return { type: 'longBreak', daysOff, recommended };
  }

  // Madcow's stall is "the top set holds" -- no forced-deload prompt, only the
  // long-break safety check above applies to it.
  if (!getProgram(preset).usesDeloads) return null;

  const pendingDeloads = getPendingFailureDeloadsForStart(historyToCheck, workoutWeights);
  if (pendingDeloads.length > 0) {
    return { type: 'failure', pendingDeloads };
  }

  return null;
};
