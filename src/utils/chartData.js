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
