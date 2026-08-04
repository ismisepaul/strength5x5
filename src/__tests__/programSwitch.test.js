import { describe, it, expect } from 'vitest';
import { mergeMadcowGains, switchProgramState } from '../programSwitch';
import { INITIAL_WEIGHTS } from '../constants';

const WEIGHTS = { squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125, incline: 50 };
const MC_TOP = { squat: 107.5, bench: 60, row: 65, deadlift: 117.5, press: 47.5, incline: 47.5 };

function switchTo(target, overrides = {}) {
  return switchProgramState({
    target,
    weights: WEIGHTS,
    mcTop: MC_TOP,
    mcWeek: 1,
    mcNextDay: 'A',
    mcPending: [],
    mcPress: 'incline',
    mcSeeded: false,
    ...overrides,
  });
}

describe('switchProgramState', () => {
  describe('switching to Madcow', () => {
    it('leaves weights untouched (same reference) when starting a fresh block', () => {
      const result = switchTo('madcow');
      expect(result.weights).toBe(WEIGHTS);
    });

    it('seeds the on-ramp top set, week 1, day A, and an empty pending list when unseeded', () => {
      const result = switchTo('madcow', { mcSeeded: false });
      expect(result.mcTop.squat).toBe(107.5);
      expect(result.mcWeek).toBe(1);
      expect(result.mcNextDay).toBe('A');
      expect(result.mcPending).toEqual([]);
      expect(result.mcSeeded).toBe(true);
    });

    it('resumes the saved state instead of re-seeding when a block is already in progress', () => {
      const savedTop = { squat: 130, bench: 72.5, row: 77.5, deadlift: 140, press: 62.5, incline: 60 };
      const result = switchTo('madcow', { mcSeeded: true, mcTop: savedTop, mcWeek: 6, mcNextDay: 'C', mcPending: ['squat'] });
      expect(result.mcTop).toBe(savedTop);
      expect(result.mcWeek).toBe(6);
      expect(result.mcNextDay).toBe('C');
      expect(result.mcPending).toEqual(['squat']);
      expect(result.weights).toBe(WEIGHTS);
    });
  });

  describe('switching to Standard', () => {
    it('takes the max of the Standard weight and the Madcow top set per lift', () => {
      const higherTop = { squat: 130, bench: 60, row: 65, deadlift: 117.5, press: 47.5, incline: 47.5 };
      const result = switchTo('standard', { mcTop: higherTop });
      expect(result.weights.squat).toBe(130); // mcTop was higher
      expect(result.weights.row).toBe(72.5);  // weights was higher
    });

    it('leaves mcTop/mcWeek/mcNextDay/mcPending untouched so a later switch back can resume', () => {
      const result = switchTo('standard', { mcWeek: 6, mcNextDay: 'C', mcPending: ['squat'] });
      expect(result.mcTop).toBe(MC_TOP);
      expect(result.mcWeek).toBe(6);
      expect(result.mcNextDay).toBe('C');
      expect(result.mcPending).toEqual(['squat']);
    });
  });
});

describe('mergeMadcowGains', () => {
  it('merges squat/bench/row/deadlift/incline as the max of the two sides', () => {
    const result = mergeMadcowGains(WEIGHTS, MC_TOP, 'incline');
    expect(result.squat).toBe(115);
    expect(result.bench).toBe(67.5);
    expect(result.incline).toBe(50);
  });

  it('leaves press untouched when Madcow trained incline instead', () => {
    const higherPressTop = { ...MC_TOP, press: 90 };
    const result = mergeMadcowGains(WEIGHTS, higherPressTop, 'incline');
    expect(result.press).toBe(55);
  });

  it('merges press when Madcow actually trained overhead press', () => {
    const higherPressTop = { ...MC_TOP, press: 90 };
    const result = mergeMadcowGains(WEIGHTS, higherPressTop, 'press');
    expect(result.press).toBe(90);
  });

  it('falls back to a bench-derived incline seed when weights.incline is missing (pre-incline saves)', () => {
    const legacyWeights = { squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125 };
    const result = mergeMadcowGains(legacyWeights, { ...MC_TOP, incline: 40 }, 'incline');
    // seedInclineWeight(67.5) = round(67.5*0.8 / 2.5) * 2.5 = 55, which beats mcTop.incline (40)
    expect(result.incline).toBe(55);
  });
});

describe('round-trip invariance (standard -> madcow -> standard)', () => {
  const cases = [
    { squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125, incline: 50 },
    { squat: 60, bench: 40, row: 45, press: 30, deadlift: 80, incline: 35 },
    { squat: 200, bench: 120, row: 110, press: 80, deadlift: 220, incline: 100 },
    // Near-the-bar floors: exactly the "everything reset to 20kg" report.
    { squat: 22.5, bench: 20, row: 20, press: 20, deadlift: 40, incline: 20 },
  ];

  it.each(cases)('returns the original weights for %o', (startWeights) => {
    const toMadcow = switchProgramState({
      target: 'madcow', weights: startWeights, mcTop: {}, mcWeek: 1, mcNextDay: 'A', mcPending: [], mcPress: 'incline', mcSeeded: false,
    });
    const backToStandard = switchProgramState({
      target: 'standard', weights: toMadcow.weights, mcTop: toMadcow.mcTop, mcWeek: toMadcow.mcWeek,
      mcNextDay: toMadcow.mcNextDay, mcPending: toMadcow.mcPending, mcPress: 'incline', mcSeeded: toMadcow.mcSeeded,
    });
    expect(backToStandard.weights).toEqual(startWeights);
  });

  it('survives twenty repeated round trips without any weight moving', () => {
    let weights = { squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125, incline: 50 };
    let mcTop = {}, mcWeek = 1, mcNextDay = 'A', mcPending = [], mcSeeded = false;

    for (let i = 0; i < 20; i++) {
      const toMadcow = switchProgramState({ target: 'madcow', weights, mcTop, mcWeek, mcNextDay, mcPending, mcPress: 'incline', mcSeeded });
      const toStandard = switchProgramState({
        target: 'standard', weights: toMadcow.weights, mcTop: toMadcow.mcTop, mcWeek: toMadcow.mcWeek,
        mcNextDay: toMadcow.mcNextDay, mcPending: toMadcow.mcPending, mcPress: 'incline', mcSeeded: toMadcow.mcSeeded,
      });
      ({ weights, mcTop, mcWeek, mcNextDay, mcPending, mcSeeded } = { weights: toStandard.weights, mcTop: toStandard.mcTop, mcWeek: toStandard.mcWeek, mcNextDay: toStandard.mcNextDay, mcPending: toStandard.mcPending, mcSeeded: toStandard.mcSeeded });
    }

    expect(weights).toEqual({ squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125, incline: 50 });
  });

  it('fuzz: round-trips fifty random weight sets on the plate grid without loss', () => {
    // Real Standard saves have no incline weight of their own -- it's a Madcow-only
    // lift seeded from bench (seedInclineWeight) -- so a round trip is free to raise
    // it (that's not "loss") but must never move squat/bench/row/press/deadlift.
    // Each lift is generated at or above its own empty-bar floor (INITIAL_WEIGHTS),
    // same as clampMcTop enforces -- a weight below that floor isn't reachable in the
    // app in the first place, on either program.
    function randomWeightsSet() {
      const rand = (id) => INITIAL_WEIGHTS[id] + Math.round((Math.random() * 180) / 2.5) * 2.5;
      return { squat: rand('squat'), bench: rand('bench'), row: rand('row'), press: rand('press'), deadlift: rand('deadlift') };
    }

    for (let i = 0; i < 50; i++) {
      const startWeights = randomWeightsSet();
      const toMadcow = switchProgramState({ target: 'madcow', weights: startWeights, mcTop: {}, mcWeek: 1, mcNextDay: 'A', mcPending: [], mcPress: 'incline', mcSeeded: false });
      const backToStandard = switchProgramState({
        target: 'standard', weights: toMadcow.weights, mcTop: toMadcow.mcTop, mcWeek: toMadcow.mcWeek,
        mcNextDay: toMadcow.mcNextDay, mcPending: toMadcow.mcPending, mcPress: 'incline', mcSeeded: toMadcow.mcSeeded,
      });
      expect(backToStandard.weights).toMatchObject(startWeights);
    }
  });
});
