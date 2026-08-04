import { INITIAL_WEIGHTS, MADCOW_WEEKLY_INCREMENTS } from './constants';
import { buildMadcowLiftPlan, roundWeight } from './utils';

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
