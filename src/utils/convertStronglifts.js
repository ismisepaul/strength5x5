const EXERCISE_MAP = {
  'Squat': { id: 'squat', name: 'Back Squat', sets: 5, reps: 5, increment: 2.5 },
  'Bench Press': { id: 'bench', name: 'Bench Press', sets: 5, reps: 5, increment: 2.5 },
  'Barbell Row': { id: 'row', name: 'Barbell Row', sets: 5, reps: 5, increment: 2.5 },
  'Overhead Press': { id: 'press', name: 'Overhead Press', sets: 5, reps: 5, increment: 2.5 },
  'Deadlift': { id: 'deadlift', name: 'Deadlift', sets: 1, reps: 5, increment: 5 },
};

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

export function convertStrongliftsCSV(csvText) {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length <= 1) return { weights: null, history: [], nextType: 'A' };

  const rows = lines.slice(1).map(parseCSVLine);
  const sessionMap = new Map();

  for (const cols of rows) {
    const dateRaw = cols[0];
    const workoutName = cols[2];
    const exerciseName = cols[5];

    const config = EXERCISE_MAP[exerciseName];
    if (!config) continue;

    const type = workoutName.includes('A') ? 'A' : 'B';
    const [y, m, d] = dateRaw.split('/');
    const isoDate = new Date(`${y}-${m}-${d}T12:00:00`).toISOString();

    const setsCompleted = [];
    for (let i = 0; i < config.sets; i++) {
      const repCol = 17 + i * 2;
      const repVal = cols[repCol];
      setsCompleted.push(repVal && repVal !== '' ? parseInt(repVal, 10) : null);
    }

    const weight = parseFloat(cols[18]) || 20;

    if (!sessionMap.has(dateRaw)) {
      sessionMap.set(dateRaw, { date: isoDate, type, exercises: [] });
    }

    sessionMap.get(dateRaw).exercises.push({
      id: config.id,
      name: config.name,
      weight,
      sets: config.sets,
      reps: config.reps,
      increment: config.increment,
      setsCompleted,
    });
  }

  const history = [...sessionMap.values()].reverse();

  const currentWeights = { squat: 20, bench: 20, row: 20, press: 20, deadlift: 40 };
  for (let i = history.length - 1; i >= 0; i--) {
    for (const ex of history[i].exercises) {
      currentWeights[ex.id] = ex.weight;
    }
  }

  const lastSession = history[0];
  const nextType = lastSession?.type === 'A' ? 'B' : 'A';

  return { weights: currentWeights, history, nextType };
}
