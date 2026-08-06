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

describe('Add workout always logs for the active program', () => {
  it('defaults to the active program\'s current day, with no program picker', async () => {
    seed(); // preset defaults to standard, nextType 'A'
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByLabelText('Add workout'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Standard 5×5')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Madcow 5×5' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Workout A' })).toHaveClass('border-accent');
    // Standard is editable -- the +/- weight steppers are present.
    expect(within(dialog).getByLabelText('Decrease Back Squat weight')).toBeInTheDocument();
  });

  it('offers Madcow\'s A/B/C days and a read-only ramp when Madcow is active', async () => {
    seed({
      preset: 'madcow',
      mcTop: { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 },
      mcWeek: 5,
      mcPress: 'incline',
      mcNextDay: 'A',
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByLabelText('Add workout'));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('Madcow 5×5')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Workout A' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Workout B' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Workout C' })).toBeInTheDocument();
    // Read-only -- no +/- weight steppers.
    expect(within(dialog).queryByLabelText('Decrease Back Squat weight')).not.toBeInTheDocument();

    // Day B carries the second-press lift -- reflects the chosen incline, not press.
    await user.click(within(dialog).getByRole('button', { name: 'Workout B' }));
    expect(within(dialog).getByText('Incline Bench')).toBeInTheDocument();
    expect(within(dialog).queryByText('Overhead Press')).not.toBeInTheDocument();
  });

  it('still progresses a Standard entry logged as the newest session while Standard is active', async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    const before = JSON.parse(localStorage.getItem(STORAGE_KEY));

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByLabelText('Add workout'));
    const dialog = screen.getByRole('dialog');
    // Left as the pre-filled full pass -- unchanged day.
    await user.click(within(dialog).getByRole('button', { name: 'Add workout' }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(before.weights.squat + 2.5);
  });

  it('does not progress weights when editing an old entry from the other program', async () => {
    // Edge case unreachable via a *new* entry (there's no program picker any more), but
    // still reachable by editing an old session logged before the last program switch.
    seed({
      preset: 'madcow',
      mcTop: { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 },
      mcWeek: 5,
      mcPress: 'incline',
      history: [
        { date: new Date().toISOString(), type: 'A', preset: 'standard', exercises: [{ id: 'squat', weight: 115, sets: 5, reps: 5, setsCompleted: [5, 5, 5, 5, 5] }] },
      ],
    });
    const user = userEvent.setup();
    render(<App />);

    const before = JSON.parse(localStorage.getItem(STORAGE_KEY));

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByText('Workout A'));
    await user.click(screen.getByText('Edit workout'));
    const dialog = screen.getByRole('dialog', { name: 'Edit workout' });
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(before.weights.squat);
    expect(stored.mcTop).toEqual(before.mcTop);
  });
});
