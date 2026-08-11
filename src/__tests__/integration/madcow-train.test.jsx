import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { STORAGE_KEY, ACTIVE_WORKOUT_KEY } from '../../constants';
import { START_BUTTON, startWorkout } from '../helpers/train';

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

function seedMadcow(overrides = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    weights: { squat: 107.5, bench: 65, row: 70, press: 55, deadlift: 117.5, incline: 50 },
    history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
    nextType: 'A',
    isDark: true,
    autoSave: false,
    preferredRest: 90,
    soundEnabled: false,
    vibrationEnabled: false,
    preset: 'madcow',
    mcTop: { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 },
    mcWeek: 5, // past the on-ramp, so progression is live
    mcInterval: 12.5,
    mcPress: 'incline',
    mcNextDay: 'A',
    ...overrides,
  }));
}

const squatCard = () => within(screen.getByText('Back Squat').closest('.border'));

describe('Train tab under Madcow', () => {
  it('shows the ramp meta and an editable top-set weight before starting', async () => {
    seedMadcow();
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('Madcow 5×5 · week 5')).toBeInTheDocument();
    expect(screen.getByText('5 ramp sets · 55 → 107.5 kg')).toBeInTheDocument();
    // The top-set weight is editable, same as the Program tab.
    expect(screen.getByDisplayValue('107.5')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Increase Back Squat top set'));
    expect(screen.getByDisplayValue('110')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcTop.squat).toBe(110);
    // A Madcow top-set edit is its own state now -- it never touches Standard's
    // weights (see programSwitch.js), so a later switch back to Standard isn't
    // silently pre-loaded with an edit made mid-Madcow-block.
    expect(stored.weights.squat).toBe(107.5);
  });

  it('logs a ramped session with per-set weights and queues the top set to progress at the Friday rollover', async () => {
    seedMadcow();
    const user = userEvent.setup();
    render(<App />);

    await startWorkout(user);

    // The top-of-ramp set (set 5) for squat should read its own weight beneath it.
    expect(squatCard().getByText('107.5')).toBeInTheDocument();

    const allSetButtons = screen.getAllByRole('button').filter(btn => (btn.getAttribute('aria-label') || '').startsWith('Set '));
    for (const btn of allSetButtons) {
      await user.click(btn);
    }

    await user.click(screen.getByText('Finish workout'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // The live top set stays at this week's actual Monday weight -- Wednesday's squat
    // ramp and Friday's `top + increment` attempt both still need to read that same
    // number. The earned bump is queued and only lands at Friday's rollover.
    expect(stored.mcTop.squat).toBe(107.5);
    expect(stored.mcTop.bench).toBe(65);
    // Finishing a Madcow session never touches Standard's weights either.
    expect(stored.weights.squat).toBe(107.5);
    expect(stored.mcPending.sort()).toEqual(['bench', 'row', 'squat']);
    expect(stored.mcNextDay).toBe('B');
    expect(stored.history[0].preset).toBe('madcow');
  });

  it('tracks the in-progress set\'s weight, advancing as sets are logged, without touching next week\'s top set', async () => {
    seedMadcow();
    const user = userEvent.setup();
    render(<App />);

    await startWorkout(user);

    // Before anything is logged, the control tracks set 1 -- the lightest ramp rung --
    // not the top set.
    expect(squatCard().getByDisplayValue('55')).toBeInTheDocument();
    expect(squatCard().getByText('Set 1 of 5')).toBeInTheDocument();

    await user.click(squatCard().getByLabelText('Increase Back Squat weight'));

    // The edit only touches set 1's own weight, both in the control and the per-set
    // readout beneath it -- it never reads or writes as a "top set".
    expect(squatCard().getByDisplayValue('57.5')).toBeInTheDocument();
    expect(squatCard().getAllByText('57.5').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Increase Back Squat top set')).not.toBeInTheDocument();

    // It's a session-only nudge -- next week's programmed top set, and Standard's
    // weights, are both untouched.
    let stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcTop.squat).toBe(107.5);
    expect(stored.weights.squat).toBe(107.5);

    // Logging set 1 advances the control to track set 2 next.
    const firstSquatSet = squatCard().getAllByLabelText('Set 1')[0];
    await user.click(firstSquatSet);
    expect(squatCard().getByDisplayValue('67.5')).toBeInTheDocument();
    expect(squatCard().getByText('Set 2 of 5')).toBeInTheDocument();

    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcTop.squat).toBe(107.5);
  });

  it('shows the Madcow-specific missed-reps note instead of the Standard one', async () => {
    seedMadcow();
    const user = userEvent.setup();
    render(<App />);

    await startWorkout(user);

    const firstSquatSet = squatCard().getAllByLabelText('Set 1')[0];
    // Cycle down from the target (5) to 4 reps -- a miss.
    await user.click(firstSquatSet);
    await user.click(firstSquatSet);

    expect(squatCard().getByText('Missed reps: top set stays at current weight next week')).toBeInTheDocument();
  });

  it('Wednesday\'s squat ramp still targets this week\'s frozen Monday top while a bump is queued', async () => {
    // Simulates the state right after a passed Monday: mcTop hasn't moved, but
    // squat/bench/row are queued for Friday's rollover.
    seedMadcow({ mcNextDay: 'B', mcPending: ['squat', 'bench', 'row'] });
    const user = userEvent.setup();
    render(<App />);

    await startWorkout(user);
    const active = JSON.parse(localStorage.getItem(ACTIVE_WORKOUT_KEY));
    const squat = active.session.exercises.find(e => e.id === 'squat');
    expect(Math.max(...squat.setWeights)).toBe(80); // rung 3 of a 107.5 ramp, per computeRampWeights
  });

  it('keeps Friday\'s attempt one increment above this week\'s frozen Monday top, not stacked on top of the queued bump', async () => {
    // Simulates the state right after a passed Monday and Wednesday: same queue,
    // now starting Friday.
    seedMadcow({ mcNextDay: 'C', mcPending: ['squat', 'bench', 'row'] });
    const user = userEvent.setup();
    render(<App />);

    await startWorkout(user);
    const active = JSON.parse(localStorage.getItem(ACTIVE_WORKOUT_KEY));
    const squat = active.session.exercises.find(e => e.id === 'squat');
    // 107.5 + 2.5 = 110, not 107.5 + 2.5 + 2.5 (the bug: double-counting the queued bump).
    expect(squat.weight).toBe(110);
    expect(Math.max(...squat.setWeights)).toBe(110);

    const setButtons = screen.getAllByRole('button').filter(btn => (btn.getAttribute('aria-label') || '').startsWith('Set '));
    for (const btn of setButtons) {
      await user.click(btn);
    }
    await user.click(screen.getByText('Finish workout'));

    // Finishing Friday applies the queued bump exactly once and clears the queue.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcTop.squat).toBe(110);
    expect(stored.mcPending).toEqual([]);
    expect(stored.mcNextDay).toBe('A');
  });

  it('sizes the completion summary\'s 6-set Day C blocks to fit the row instead of overflowing it', async () => {
    seedMadcow({ mcNextDay: 'C', mcPending: ['squat', 'bench', 'row'] });
    const user = userEvent.setup();
    render(<App />);

    await startWorkout(user);
    const setButtons = screen.getAllByRole('button').filter(btn => (btn.getAttribute('aria-label') || '').startsWith('Set '));
    for (const btn of setButtons) {
      await user.click(btn);
    }
    await user.click(screen.getByText('Finish workout'));

    const dialog = await screen.findByRole('dialog', { name: 'Workout complete' });
    const squatContainer = within(dialog).getByText('Back Squat').closest('.p-3');
    const blocks = squatContainer.querySelectorAll('.bg-surface');
    expect(blocks).toHaveLength(6);
    // jsdom normalizes `(100% - 30px) / 6` to `0.16666666666666666 * (100% - 30px)` --
    // same value, different serialization. A fixed 5-slot width here (the pre-fix
    // formula) would size these blocks past 100% of the row.
    expect(blocks[0].style.width).toBe('calc(0.16666666666666666 * (100% - 30px))');
  });

  it('lets the workout picker sheet switch which day is next', async () => {
    seedMadcow();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Choose workout'));
    const dialog = screen.getByRole('dialog', { name: 'Today\'s workout' });
    expect(within(dialog).getByText('Heavy')).toBeInTheDocument();
    await user.click(within(dialog).getByText('Workout C'));

    expect(screen.getByRole('heading', { name: 'Workout C' })).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcNextDay).toBe('C');
  });
});
