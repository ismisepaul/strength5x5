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

function seed(overrides = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    weights: { squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125, incline: 50 },
    history: [
      { date: new Date(Date.now() - 86400000).toISOString(), type: 'A', preset: 'standard', exercises: [{ id: 'squat', weight: 115, sets: 5, reps: 5, setsCompleted: [5, 5, 5, 5, 5] }] },
      { date: new Date(Date.now() - 172800000).toISOString(), type: 'A', preset: 'madcow', exercises: [{ id: 'incline', weight: 50, setWeights: [30, 37.5, 42.5, 47.5, 50], setReps: [5, 5, 5, 5, 5], sets: 5, setsCompleted: [5, 5, 5, 5, 5] }] },
    ],
    nextType: 'A',
    isDark: true,
    autoSave: false,
    preferredRest: 90,
    soundEnabled: false,
    vibrationEnabled: false,
    ...overrides,
  }));
}

describe('Log entries show which program they belong to', () => {
  it('tags a Standard entry and a Madcow entry with their program name', async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));

    const cards = screen.getAllByRole('button').filter(btn => btn.textContent.includes('Workout A'));
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Standard 5×5')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Madcow 5×5')).toBeInTheDocument();
  });

  it('defaults a legacy entry with no preset field to Standard 5×5', async () => {
    seed({
      history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [{ id: 'squat', weight: 60, sets: 5, reps: 5, setsCompleted: [5, 5, 5, 5, 5] }] }],
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));

    expect(screen.getByText('Standard 5×5')).toBeInTheDocument();
  });
});

describe('Stats surfaces lifts trained under the other program', () => {
  it('keeps Incline Bench visible under Standard, noting it came from Madcow', async () => {
    seed(); // preset defaults to standard; history has a Madcow-tagged incline session
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Stats'));

    const inclineCard = screen.getByText('Incline Bench').closest('button');
    expect(within(inclineCard).getByText('From Madcow 5×5')).toBeInTheDocument();
  });

  it('keeps Overhead Press visible under Madcow (incline press), noting it came from Standard', async () => {
    seed({
      preset: 'madcow',
      mcPress: 'incline',
      mcTop: { squat: 115, bench: 67.5, row: 72.5, deadlift: 125, incline: 50 },
      history: [
        { date: new Date(Date.now() - 86400000).toISOString(), type: 'A', preset: 'standard', exercises: [{ id: 'press', weight: 55, sets: 5, reps: 5, setsCompleted: [5, 5, 5, 5, 5] }] },
      ],
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Stats'));

    const pressCard = screen.getByText('Overhead Press').closest('button');
    expect(within(pressCard).getByText('From Standard 5×5')).toBeInTheDocument();
  });

  it('does not tag the active program lifts with a from-program note', async () => {
    seed({
      history: [
        { date: new Date(Date.now() - 86400000).toISOString(), type: 'A', preset: 'standard', exercises: [{ id: 'squat', weight: 115, sets: 5, reps: 5, setsCompleted: [5, 5, 5, 5, 5] }] },
      ],
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Stats'));

    const squatCard = screen.getByText('Back Squat').closest('button');
    expect(within(squatCard).queryByText(/^From /)).not.toBeInTheDocument();
  });
});
