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

  it('leads with the program, then the workout -- Program > Workout > Sets/Reps', async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));

    const programKicker = screen.getByText('Standard 5×5');
    const workoutHeading = screen.getAllByText('Workout A')[0];
    // The kicker (program) must come before the heading (workout) in DOM order, i.e.
    // program is the outer/leading element of the hierarchy, not a footnote under it.
    expect(programKicker.compareDocumentPosition(workoutHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

describe('Add workout: pick a program, then a workout', () => {
  it('defaults to the active program and its current day', async () => {
    seed(); // preset defaults to standard, nextType 'A'
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByLabelText('Add workout'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Standard 5×5' })).toHaveClass('border-accent');
    expect(within(dialog).getByRole('button', { name: 'Workout A' })).toHaveClass('border-accent');
    // Standard is editable -- the +/- weight steppers are present.
    expect(within(dialog).getByLabelText('Decrease Back Squat weight')).toBeInTheDocument();
  });

  it('switching the program in the modal rebuilds the day options and the ramp', async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByLabelText('Add workout'));
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Madcow 5×5' }));

    expect(within(dialog).getByRole('button', { name: 'Workout A' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Workout B' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Workout C' })).toBeInTheDocument();
    // Madcow is read-only -- no +/- weight steppers, just the ramp's top weight.
    expect(within(dialog).queryByLabelText('Decrease Back Squat weight')).not.toBeInTheDocument();
  });

  it('logging a Madcow entry while Standard is active does not move mcTop or weights', async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    const before = JSON.parse(localStorage.getItem(STORAGE_KEY));

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByLabelText('Add workout'));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Madcow 5×5' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add workout' }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.history[0].preset).toBe('madcow');
    expect(stored.weights).toEqual(before.weights);
    expect(stored.mcTop).toEqual(before.mcTop);
  });

  it('logging a Standard entry as the newest session while Madcow is active does not progress weights', async () => {
    seed({
      preset: 'madcow',
      mcTop: { squat: 107.5, bench: 63.75, row: 68.75, deadlift: 117.5, press: 55, incline: 50 },
      mcWeek: 5,
      mcPress: 'incline',
      mcNextDay: 'A',
    });
    const user = userEvent.setup();
    render(<App />);

    const before = JSON.parse(localStorage.getItem(STORAGE_KEY));

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByLabelText('Add workout'));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Standard 5×5' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add workout' }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.history[0].preset).toBe('standard');
    expect(stored.weights.squat).toBe(before.weights.squat);
    expect(stored.mcTop).toEqual(before.mcTop);
    expect(stored.mcWeek).toBe(before.mcWeek);
  });

  it('still progresses a Standard entry logged as the newest session while Standard is active', async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    const before = JSON.parse(localStorage.getItem(STORAGE_KEY));

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByLabelText('Add workout'));
    const dialog = screen.getByRole('dialog');
    // Left as the pre-filled full pass -- unchanged program, unchanged day.
    await user.click(within(dialog).getByRole('button', { name: 'Add workout' }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(before.weights.squat + 2.5);
  });
});
