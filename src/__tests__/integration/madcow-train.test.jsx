import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { STORAGE_KEY } from '../../constants';

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

function seedMadcow(overrides = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    weights: { squat: 107.5, bench: 63.75, row: 68.75, press: 55, deadlift: 117.5, incline: 50 },
    history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
    nextType: 'A',
    isDark: true,
    autoSave: false,
    preferredRest: 90,
    soundEnabled: false,
    vibrationEnabled: false,
    preset: 'madcow',
    mcTop: { squat: 107.5, bench: 63.75, row: 68.75, deadlift: 117.5, press: 55, incline: 50 },
    mcWeek: 5, // past the on-ramp, so progression is live
    mcInterval: 12.5,
    mcPress: 'incline',
    mcNextDay: 'A',
    ...overrides,
  }));
}

const squatCard = () => within(screen.getByText('Back Squat').closest('.border'));

describe('Train tab under Madcow', () => {
  it('shows the ramp meta and a read-only top weight before starting', async () => {
    seedMadcow();
    render(<App />);

    expect(screen.getByText('Madcow 5×5 · week 5')).toBeInTheDocument();
    expect(screen.getByText('5 ramp sets · 55 → 107.5 kg')).toBeInTheDocument();
    expect(screen.getByText('107.5kg')).toBeInTheDocument();
    // No pencil-edit affordance for a Madcow lift.
    expect(screen.queryByLabelText('Edit Back Squat weight')).not.toBeInTheDocument();
  });

  it('logs a ramped session with per-set weights and progresses the top set once past the on-ramp', async () => {
    seedMadcow();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));

    // The top-of-ramp set (set 5) for squat should read its own weight beneath it.
    expect(squatCard().getByText('107.5')).toBeInTheDocument();

    const allSetButtons = screen.getAllByRole('button').filter(btn => (btn.getAttribute('aria-label') || '').startsWith('Set '));
    for (const btn of allSetButtons) {
      await user.click(btn);
    }

    await user.click(screen.getByText('Finish workout'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcTop.squat).toBe(110);
    expect(stored.mcTop.bench).toBe(65);
    expect(stored.weights.squat).toBe(110);
    expect(stored.mcNextDay).toBe('B');
    expect(stored.history[0].preset).toBe('madcow');
  });

  it('shows the Madcow-specific missed-reps note instead of the Standard one', async () => {
    seedMadcow();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));

    const firstSquatSet = squatCard().getAllByLabelText('Set 1')[0];
    // Cycle down from the target (5) to 4 reps -- a miss.
    await user.click(firstSquatSet);
    await user.click(firstSquatSet);

    expect(squatCard().getByText('Missed reps — top set holds next week')).toBeInTheDocument();
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
