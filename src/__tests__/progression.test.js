import { describe, it, expect } from 'vitest';
import { evaluateWorkoutOutcome, getPendingFailureDeloadsForStart, getStartDeloadPrompt } from '../progression';

const passedEx = (id, weight, sets = 5, reps = 5) => ({
  id, weight, sets, reps, setsCompleted: Array(sets).fill(reps),
});
const failedEx = (id, weight, sets = 5, reps = 5, got = reps - 1) => ({
  id, weight, sets, reps, setsCompleted: Array(sets).fill(got),
});

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

describe('evaluateWorkoutOutcome', () => {
  it('progresses every exercise that hit its full rep target by its increment', () => {
    const workout = { type: 'A', exercises: [passedEx('squat', 60), passedEx('bench', 40)] };
    const { nextWeights, progressions, pendingDeloads } = evaluateWorkoutOutcome(workout, [], { squat: 60, bench: 40 });
    expect(nextWeights).toEqual({ squat: 62.5, bench: 42.5 });
    expect(progressions).toEqual(['squat', 'bench']);
    expect(pendingDeloads).toEqual([]);
  });

  it('uses the deadlift-specific 5kg increment as a fallback when no increment is set on the exercise', () => {
    const workout = { type: 'B', exercises: [passedEx('deadlift', 100, 1, 5)] };
    const { nextWeights } = evaluateWorkoutOutcome(workout, [], { deadlift: 100 });
    expect(nextWeights.deadlift).toBe(105);
  });

  it('prefers an exercise-level increment over the workout-day default', () => {
    const workout = { type: 'A', exercises: [{ ...passedEx('squat', 60), increment: 1.25 }] };
    const { nextWeights } = evaluateWorkoutOutcome(workout, [], { squat: 60 });
    expect(nextWeights.squat).toBe(61.25);
  });

  it('leaves the weight unchanged on a failed exercise with no prior failure streak', () => {
    const workout = { type: 'A', exercises: [failedEx('squat', 60)] };
    const { nextWeights, progressions, pendingDeloads } = evaluateWorkoutOutcome(workout, [], { squat: 60 });
    expect(nextWeights.squat).toBe(60);
    expect(progressions).toEqual([]);
    expect(pendingDeloads).toEqual([]);
  });

  it('flags a pending deload once a failure streak reaches 2 prior sessions at the same weight', () => {
    const priorHistory = [
      { exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
    ];
    const workout = { type: 'A', exercises: [failedEx('squat', 60)] };
    const { pendingDeloads } = evaluateWorkoutOutcome(workout, priorHistory, { squat: 60 });
    expect(pendingDeloads).toEqual([{ id: 'squat', currentWeight: 60 }]);
  });

  it('does not flag a deload when the failure streak is at a different weight', () => {
    const priorHistory = [
      { exercises: [failedEx('squat', 57.5)] },
      { exercises: [failedEx('squat', 57.5)] },
    ];
    const workout = { type: 'A', exercises: [failedEx('squat', 60)] };
    const { pendingDeloads } = evaluateWorkoutOutcome(workout, priorHistory, { squat: 60 });
    expect(pendingDeloads).toEqual([]);
  });
});

describe('getPendingFailureDeloadsForStart', () => {
  it('returns nothing when there is no history', () => {
    expect(getPendingFailureDeloadsForStart([], { squat: 60 })).toEqual([]);
  });

  it('flags an exercise with 3+ consecutive failures at its latest logged weight', () => {
    const history = [
      { exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
    ];
    const pending = getPendingFailureDeloadsForStart(history, { squat: 60 });
    expect(pending).toEqual([{ id: 'squat', currentWeight: 60 }]);
  });

  it('does not flag an exercise with only 2 consecutive failures', () => {
    const history = [
      { exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
    ];
    expect(getPendingFailureDeloadsForStart(history, { squat: 60 })).toEqual([]);
  });

  it('reports the currently-planned weight, not the historical failing weight', () => {
    // User already deloaded manually after the streak -- the prompt should offer to
    // deload from where they're about to lift, not from the old stalled weight.
    const history = [
      { exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
    ];
    const pending = getPendingFailureDeloadsForStart(history, { squat: 55 });
    expect(pending).toEqual([{ id: 'squat', currentWeight: 55 }]);
  });

  it('stops counting the streak at a session where the exercise passed', () => {
    const history = [
      { exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
      { exercises: [passedEx('squat', 60)] }, // breaks the streak
      { exercises: [failedEx('squat', 60)] },
    ];
    expect(getPendingFailureDeloadsForStart(history, { squat: 60 })).toEqual([]);
  });
});

describe('getStartDeloadPrompt', () => {
  it('returns null with no history', () => {
    expect(getStartDeloadPrompt([], {}, { longBreakDeloadForDate: null, preset: 'standard' })).toBeNull();
  });

  it('prompts a long-break deload after 14+ days off', () => {
    const history = [{ date: daysAgo(15), exercises: [] }];
    const prompt = getStartDeloadPrompt(history, {}, { longBreakDeloadForDate: null, preset: 'standard' });
    expect(prompt).toMatchObject({ type: 'longBreak', daysOff: 15, recommended: 10 });
  });

  it('does not re-prompt a long break already acknowledged for that session date', () => {
    const lastDate = daysAgo(20);
    const history = [{ date: lastDate, exercises: [] }];
    const prompt = getStartDeloadPrompt(history, {}, { longBreakDeloadForDate: lastDate, preset: 'standard' });
    expect(prompt).toBeNull();
  });

  it('long-break takes precedence over a failure deload', () => {
    const history = [
      { date: daysAgo(15), exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
    ];
    const prompt = getStartDeloadPrompt(history, { squat: 60 }, { longBreakDeloadForDate: null, preset: 'standard' });
    expect(prompt.type).toBe('longBreak');
  });

  it('prompts a failure deload for the Standard program once the streak hits 3', () => {
    const history = [
      { date: daysAgo(1), exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
    ];
    const prompt = getStartDeloadPrompt(history, { squat: 60 }, { longBreakDeloadForDate: null, preset: 'standard' });
    expect(prompt).toEqual({ type: 'failure', pendingDeloads: [{ id: 'squat', currentWeight: 60 }] });
  });

  it('never prompts a failure deload for Madcow -- its stall is the top set holding, not a forced prompt', () => {
    const history = [
      { date: daysAgo(1), exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
      { exercises: [failedEx('squat', 60)] },
    ];
    const prompt = getStartDeloadPrompt(history, { squat: 60 }, { longBreakDeloadForDate: null, preset: 'madcow' });
    expect(prompt).toBeNull();
  });
});
