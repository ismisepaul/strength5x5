import { describe, it, expect } from 'vitest';
import { convertStrongliftsCSV } from '../../utils/convertStronglifts';

const HEADER = 'Date (yyyy/mm/dd),Workout,Workout Name,Program Name,Body Weight (KG),Exercise,SetsxReps,SetsxTime,Top Set Reps x KG,e1RM  (KG),Reps,Volume (KG),Workout Volume (KG),Duration (hours),Start Time (h:mm),End Time (h:mm),Notes,Set 1 (Reps), Set 1 (KG),Set 2 (Reps), Set 2 (KG),Set 3 (Reps), Set 3 (KG),Set 4 (Reps), Set 4 (KG),Set 5 (Reps), Set 5 (KG)';

function row(date, workout, exercise, reps, weight) {
  const sets = reps.map((r, i) => `"${r ?? ''}","${r != null ? weight : ''}"`);
  while (sets.length < 5) sets.push('"",""');
  return `"${date}","1","${workout}","","75","${exercise}","5x5","","","","","","","","","","",${sets.join(',')}`;
}

function buildCSV(...rows) {
  return [HEADER, ...rows].join('\n');
}

describe('convertStrongliftsCSV', () => {
  it('parses a minimal 2-session CSV into correct structure', () => {
    const csv = buildCSV(
      row('2024/01/01', 'Workout A', 'Squat', [5,5,5,5,5], 40),
      row('2024/01/01', 'Workout A', 'Bench Press', [5,5,5,5,5], 30),
      row('2024/01/01', 'Workout A', 'Barbell Row', [5,5,5,5,5], 35),
      row('2024/01/03', 'Workout B', 'Squat', [5,5,5,5,5], 42.5),
      row('2024/01/03', 'Workout B', 'Overhead Press', [5,5,5,5,5], 25),
      row('2024/01/03', 'Workout B', 'Deadlift', [5], 60),
    );
    const result = convertStrongliftsCSV(csv);

    expect(result.history).toHaveLength(2);
    expect(result.history[0].date).toContain('2024-01-03');
    expect(result.history[0].type).toBe('B');
    expect(result.history[1].date).toContain('2024-01-01');
    expect(result.history[1].type).toBe('A');
  });

  it('maps exercise names to correct IDs', () => {
    const csv = buildCSV(
      row('2024/01/01', 'Workout A', 'Squat', [5,5,5,5,5], 20),
      row('2024/01/01', 'Workout A', 'Bench Press', [5,5,5,5,5], 20),
      row('2024/01/01', 'Workout A', 'Barbell Row', [5,5,5,5,5], 30),
    );
    const result = convertStrongliftsCSV(csv);
    const ids = result.history[0].exercises.map(e => e.id);
    expect(ids).toEqual(['squat', 'bench', 'row']);
  });

  it('extracts setsCompleted with correct rep counts', () => {
    const csv = buildCSV(
      row('2024/01/01', 'Workout A', 'Squat', [5,5,5,5,5], 40),
      row('2024/01/01', 'Workout A', 'Bench Press', [5,5,5,5,5], 30),
      row('2024/01/01', 'Workout A', 'Barbell Row', [5,5,5,5,5], 35),
    );
    const result = convertStrongliftsCSV(csv);
    expect(result.history[0].exercises[0].setsCompleted).toEqual([5,5,5,5,5]);
  });

  it('handles deadlift as 1x5 with only 1 set populated', () => {
    const csv = buildCSV(
      row('2024/01/01', 'Workout B', 'Squat', [5,5,5,5,5], 40),
      row('2024/01/01', 'Workout B', 'Overhead Press', [5,5,5,5,5], 25),
      row('2024/01/01', 'Workout B', 'Deadlift', [5], 60),
    );
    const result = convertStrongliftsCSV(csv);
    const dl = result.history[0].exercises.find(e => e.id === 'deadlift');
    expect(dl.sets).toBe(1);
    expect(dl.reps).toBe(5);
    expect(dl.setsCompleted).toEqual([5]);
  });

  it('handles failed sets with partial reps', () => {
    const csv = buildCSV(
      row('2024/01/01', 'Workout B', 'Squat', [5,5,5,5,5], 40),
      row('2024/01/01', 'Workout B', 'Overhead Press', [5,5,5,5,3], 37.5),
      row('2024/01/01', 'Workout B', 'Deadlift', [5], 60),
    );
    const result = convertStrongliftsCSV(csv);
    const ohp = result.history[0].exercises.find(e => e.id === 'press');
    expect(ohp.setsCompleted).toEqual([5,5,5,5,3]);
  });

  it('sets nextType as opposite of last session type', () => {
    const csvA = buildCSV(
      row('2024/01/01', 'Workout A', 'Squat', [5,5,5,5,5], 40),
      row('2024/01/01', 'Workout A', 'Bench Press', [5,5,5,5,5], 30),
      row('2024/01/01', 'Workout A', 'Barbell Row', [5,5,5,5,5], 35),
    );
    expect(convertStrongliftsCSV(csvA).nextType).toBe('B');

    const csvB = buildCSV(
      row('2024/01/01', 'Workout A', 'Squat', [5,5,5,5,5], 40),
      row('2024/01/01', 'Workout A', 'Bench Press', [5,5,5,5,5], 30),
      row('2024/01/01', 'Workout A', 'Barbell Row', [5,5,5,5,5], 35),
      row('2024/01/03', 'Workout B', 'Squat', [5,5,5,5,5], 42.5),
      row('2024/01/03', 'Workout B', 'Overhead Press', [5,5,5,5,5], 25),
      row('2024/01/03', 'Workout B', 'Deadlift', [5], 60),
    );
    expect(convertStrongliftsCSV(csvB).nextType).toBe('A');
  });

  it('extracts current weights from the most recent sessions', () => {
    const csv = buildCSV(
      row('2024/01/01', 'Workout A', 'Squat', [5,5,5,5,5], 40),
      row('2024/01/01', 'Workout A', 'Bench Press', [5,5,5,5,5], 30),
      row('2024/01/01', 'Workout A', 'Barbell Row', [5,5,5,5,5], 35),
      row('2024/01/03', 'Workout B', 'Squat', [5,5,5,5,5], 42.5),
      row('2024/01/03', 'Workout B', 'Overhead Press', [5,5,5,5,5], 25),
      row('2024/01/03', 'Workout B', 'Deadlift', [5], 60),
    );
    const result = convertStrongliftsCSV(csv);
    expect(result.weights).toEqual({
      squat: 42.5,
      bench: 30,
      row: 35,
      press: 25,
      deadlift: 60,
    });
  });

  it('ignores unrecognized exercise names', () => {
    const csv = buildCSV(
      row('2024/01/01', 'Workout A', 'Squat', [5,5,5,5,5], 40),
      row('2024/01/01', 'Workout A', 'Bench Press', [5,5,5,5,5], 30),
      row('2024/01/01', 'Workout A', 'Barbell Row', [5,5,5,5,5], 35),
      row('2024/01/01', 'Workout A', 'Bicep Curl', [5,5,5,5,5], 15),
    );
    const result = convertStrongliftsCSV(csv);
    expect(result.history[0].exercises).toHaveLength(3);
    expect(result.history[0].exercises.find(e => e.id === 'curl')).toBeUndefined();
  });

  it('returns empty history for empty/header-only CSV', () => {
    expect(convertStrongliftsCSV('').history).toHaveLength(0);
    expect(convertStrongliftsCSV(HEADER).history).toHaveLength(0);
    expect(convertStrongliftsCSV(HEADER + '\n').history).toHaveLength(0);
  });
});
