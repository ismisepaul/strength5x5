import { INITIAL_WEIGHTS, MADCOW_WEEKLY_INCREMENTS } from './constants';
import { applyMcTopToWeights, buildMadcowLiftPlan, roundWeight } from './utils';

// Floors at the lift's empty-bar weight and snaps to the plate grid, so a top set
// can never end up stored (and later displayed) as something no barbell can load.
export function clampMcTop(liftId, nextTop) {
  return roundWeight(nextTop, MADCOW_WEEKLY_INCREMENTS[liftId], INITIAL_WEIGHTS[liftId] ?? 20);
}

// Re-derives one lift's ramp against a new (already-clamped) top set, without
// touching sets that are already logged: only setsCompleted[i] === null picks up
// the re-derived weight, since finishWorkout writes setWeights straight into
// history and a re-ramped rung would otherwise overwrite what was actually lifted.
export function reviseWorkoutTopSet(currentWorkout, liftId, clampedTop, mcInterval) {
  if (!currentWorkout) return currentWorkout;
  const exIdx = currentWorkout.exercises.findIndex(e => e.id === liftId);
  if (exIdx === -1) return currentWorkout;
  const plan = buildMadcowLiftPlan(currentWorkout.type, liftId, { [liftId]: clampedTop }, mcInterval);
  return {
    ...currentWorkout,
    exercises: currentWorkout.exercises.map((e, i) => {
      if (i !== exIdx) return e;
      const setWeights = plan.setWeights.map((w, si) => e.setsCompleted[si] === null ? w : e.setWeights[si]);
      return { ...e, setWeights, weight: plan.weight };
    }),
  };
}

// The single place a Madcow top set gets changed. The Program tab, Train's idle
// row, and Train's active-workout card all funnel through this (directly, or via
// clampMcTop/reviseWorkoutTopSet individually -- see App.jsx's updateMcTop), so
// persisted mcTop, the mirrored `weights` snapshot, and (if a workout for that
// lift is mid-session) its remaining ramp never drift apart from each other.
export function updateMadcowTopSet({ liftId, nextTop, mcTop, weights, mcInterval, currentWorkout }) {
  const clamped = clampMcTop(liftId, nextTop);
  const nextMcTop = { ...mcTop, [liftId]: clamped };
  const nextWeights = applyMcTopToWeights(weights, nextMcTop);
  const nextCurrentWorkout = reviseWorkoutTopSet(currentWorkout, liftId, clamped, mcInterval);

  return { mcTop: nextMcTop, weights: nextWeights, currentWorkout: nextCurrentWorkout };
}
