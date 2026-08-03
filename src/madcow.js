import { INITIAL_WEIGHTS } from './constants';
import { applyMcTopToWeights, buildMadcowLiftPlan } from './utils';

// The single place a Madcow top set gets changed. The Program tab, Train's idle
// row, and Train's active-workout card all funnel through this, so persisted
// mcTop, the mirrored `weights` snapshot, and (if a workout for that lift is
// mid-session) its remaining ramp never drift apart from each other.
export function updateMadcowTopSet({ liftId, nextTop, mcTop, weights, mcInterval, currentWorkout }) {
  const clamped = Math.max(INITIAL_WEIGHTS[liftId] ?? 20, nextTop);
  const nextMcTop = { ...mcTop, [liftId]: clamped };
  const nextWeights = applyMcTopToWeights(weights, nextMcTop);

  let nextCurrentWorkout = currentWorkout;
  const exIdx = currentWorkout?.exercises.findIndex(e => e.id === liftId) ?? -1;
  if (exIdx !== -1) {
    const plan = buildMadcowLiftPlan(currentWorkout.type, liftId, { [liftId]: clamped }, mcInterval);
    nextCurrentWorkout = {
      ...currentWorkout,
      exercises: currentWorkout.exercises.map((e, i) => i !== exIdx ? e : ({ ...e, setWeights: plan.setWeights, weight: plan.weight })),
    };
  }

  return { mcTop: nextMcTop, weights: nextWeights, currentWorkout: nextCurrentWorkout };
}
