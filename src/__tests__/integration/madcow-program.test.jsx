import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { STORAGE_KEY, ACTIVE_WORKOUT_KEY } from '../../constants';

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

function seedHistory(overrides = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    weights: { squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125 },
    history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
    nextType: 'A',
    isDark: true,
    autoSave: false,
    preferredRest: 90,
    soundEnabled: false,
    vibrationEnabled: false,
    ...overrides,
  }));
}

async function switchToMadcow(user) {
  await user.click(screen.getByLabelText('Program'));
  await user.click(screen.getByLabelText('Choose a program'));
  await user.click(screen.getByText('Madcow 5×5'));
  await user.click(screen.getByText('Switch'));
}

describe('Switching to Madcow', () => {
  it('seeds top sets from Standard weights and shows the confirm preview', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await user.click(screen.getByLabelText('Choose a program'));
    await user.click(screen.getByText('Madcow 5×5'));

    const dialog = screen.getByRole('dialog', { name: 'Switch to Madcow 5×5?' });
    expect(within(dialog).getByText('115kg → 107.5kg top set')).toBeInTheDocument();
    expect(within(dialog).getByText('67.5kg → 63.75kg top set')).toBeInTheDocument();

    await user.click(within(dialog).getByText('Switch'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.preset).toBe('madcow');
    expect(stored.mcTop.squat).toBe(107.5);
    expect(stored.mcWeek).toBe(1);
    // Weights mirror the seeded top sets, so Stats agrees with Program.
    expect(stored.weights.squat).toBe(107.5);
  });

  it('updates the Program tab strip and body after switching', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await switchToMadcow(user);

    expect(screen.getByLabelText('Choose a program')).toHaveTextContent('Madcow 5×5');
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('On-ramp')).toBeInTheDocument();
  });

  it('adjusting a top set stepper writes through to weights too', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await switchToMadcow(user);
    await user.click(screen.getByLabelText('Increase Back Squat weight'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcTop.squat).toBe(110);
    expect(stored.weights.squat).toBe(110);
  });

  it('typing a top set directly writes through to weights too', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await switchToMadcow(user);
    const squatInput = screen.getByDisplayValue('107.5');
    await user.clear(squatInput);
    await user.type(squatInput, '120');
    await user.tab();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcTop.squat).toBe(120);
    expect(stored.weights.squat).toBe(120);
  });

  it('builds a ramped session when starting a Madcow workout', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await switchToMadcow(user);
    await user.click(screen.getByLabelText('Train'));
    await user.click(screen.getByText('Start workout'));

    const active = JSON.parse(localStorage.getItem(ACTIVE_WORKOUT_KEY));
    expect(active.session.type).toBe('A');
    const squat = active.session.exercises.find(e => e.id === 'squat');
    expect(squat.setWeights).toEqual([55, 67.5, 80, 95, 107.5]);
    expect(squat.setReps).toEqual([5, 5, 5, 5, 5]);
  });
});

describe('Stats under Madcow', () => {
  it('lists Incline Bench instead of Overhead Press, and Standard exercises when active', async () => {
    seedHistory({ preset: 'madcow', mcTop: { squat: 107.5, bench: 63.75, row: 68.75, deadlift: 117.5, press: 55, incline: 50 }, mcPress: 'incline' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Stats'));
    const inclineCard = within(screen.getByText('Incline Bench').closest('.border'));
    expect(inclineCard.getByText('No sessions logged for this lift yet.')).toBeInTheDocument();
    expect(screen.queryByText('Overhead Press')).not.toBeInTheDocument();
  });

  it('drops back to Overhead Press once switched back to Standard', async () => {
    seedHistory({ preset: 'standard' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Stats'));
    expect(screen.getByText('Overhead Press')).toBeInTheDocument();
    expect(screen.queryByText('Incline Bench')).not.toBeInTheDocument();
  });
});

describe('Switching back to Standard', () => {
  it('carries the current top set back as the flat working weight', async () => {
    seedHistory({ preset: 'madcow', mcTop: { squat: 120, bench: 70, row: 75, deadlift: 130, press: 60, incline: 55 }, mcWeek: 5, mcPress: 'incline' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await user.click(screen.getByLabelText('Choose a program'));
    await user.click(screen.getByText('Standard 5×5'));

    const dialog = screen.getByRole('dialog', { name: 'Back to Standard 5×5?' });
    expect(within(dialog).getByText('120kg every set')).toBeInTheDocument();
    await user.click(within(dialog).getByText('Switch'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.preset).toBe('standard');
    expect(stored.weights.squat).toBe(120);
  });
});
