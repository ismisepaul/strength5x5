import { describe, it, expect } from 'vitest';
import { PROGRAMS, PROGRAM_IDS, getProgram, programAllLiftIds, topWeightOf } from '../../programs';
import { getProgramExercises, getMadcowDayExercises, getMadcowDayLiftIds, normalizeProgram } from '../../utils';
import { DEFAULT_PROGRAM, EXPECTED_WEIGHT_KEYS } from '../../constants';

const weights = { squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125, incline: 50 };
const mcTop = { squat: 107.5, bench: 63.75, row: 68.75, deadlift: 117.5, press: 55, incline: 50 };
const program = normalizeProgram(DEFAULT_PROGRAM);
const state = { program, weights, mcTop, mcInterval: 12.5, mcPress: 'incline' };

describe('getProgram', () => {
  it('resolves both known ids', () => {
    expect(getProgram('standard').id).toBe('standard');
    expect(getProgram('madcow').id).toBe('madcow');
  });

  it('falls back to standard for a corrupt or missing preset, same as normalizePreset', () => {
    expect(getProgram(undefined).id).toBe('standard');
    expect(getProgram('bogus').id).toBe('standard');
  });
});

describe('PROGRAM_IDS', () => {
  it('lists exactly the registered programs', () => {
    expect(PROGRAM_IDS).toEqual(['standard', 'madcow']);
  });
});

describe('standard adapter', () => {
  it('liftIds matches getProgramExercises ids for both days', () => {
    for (const day of PROGRAMS.standard.days) {
      expect(PROGRAMS.standard.liftIds(day, state)).toEqual(getProgramExercises(day, program).map(ex => ex.id));
    }
  });

  it('dayExercises matches getProgramExercises with weight merged in', () => {
    const expected = getProgramExercises('A', program).map(ex => ({ ...ex, weight: weights[ex.id] }));
    expect(PROGRAMS.standard.dayExercises('A', state)).toEqual(expected);
  });

  it('dayMood is always null', () => {
    expect(PROGRAMS.standard.dayMood('A')).toBeNull();
  });
});

describe('madcow adapter', () => {
  it('liftIds matches getMadcowDayLiftIds for every day', () => {
    for (const day of PROGRAMS.madcow.days) {
      expect(PROGRAMS.madcow.liftIds(day, state)).toEqual(getMadcowDayLiftIds(day, state.mcPress));
    }
  });

  it('dayExercises matches getMadcowDayExercises for every day', () => {
    for (const day of PROGRAMS.madcow.days) {
      expect(PROGRAMS.madcow.dayExercises(day, state)).toEqual(getMadcowDayExercises(day, mcTop, state.mcInterval, state.mcPress));
    }
  });

  it('dayMood reflects each day\'s intensity', () => {
    expect(PROGRAMS.madcow.dayMood('A')).toBe('medium');
    expect(PROGRAMS.madcow.dayMood('B')).toBe('light');
    expect(PROGRAMS.madcow.dayMood('C')).toBe('heavy');
  });
});

describe('programAllLiftIds', () => {
  it('unions Standard\'s two days without duplicating squat', () => {
    const ids = programAllLiftIds('standard', state);
    expect(ids).toEqual(EXPECTED_WEIGHT_KEYS);
  });

  it('unions Madcow\'s three days without duplicating squat', () => {
    const ids = programAllLiftIds('madcow', state);
    expect(ids).toEqual(['squat', 'bench', 'row', 'incline', 'deadlift']);
  });
});

describe('topWeightOf', () => {
  it('returns the flat weight for a Standard-shaped entry', () => {
    expect(topWeightOf({ weight: 115 })).toBe(115);
  });

  it('returns the ramp max for a Madcow-shaped entry, including a back-off day', () => {
    expect(topWeightOf({ weight: 110, setWeights: [55, 67.5, 80, 95, 107.5] })).toBe(107.5);
    expect(topWeightOf({ weight: 110, setWeights: [55, 67.5, 80, 95, 110, 80] })).toBe(110);
  });
});
