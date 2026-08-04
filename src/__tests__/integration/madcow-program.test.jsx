import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
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
    expect(within(dialog).getByText('67.5kg → 60kg top set')).toBeInTheDocument();

    await user.click(within(dialog).getByText('Switch'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.preset).toBe('madcow');
    expect(stored.mcTop.squat).toBe(107.5);
    expect(stored.mcWeek).toBe(1);
    // Standard's weights are untouched by the switch -- they're a separate slice of
    // state now, so they're waiting exactly as they were if the user switches back.
    expect(stored.weights.squat).toBe(115);
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

  it('adjusting a top set stepper writes to mcTop, leaving Standard weights alone', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await switchToMadcow(user);
    await user.click(screen.getByLabelText('Increase Back Squat top set'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcTop.squat).toBe(110);
    expect(stored.weights.squat).toBe(115);
  });

  it('typing a top set directly writes to mcTop, leaving Standard weights alone', async () => {
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
    expect(stored.weights.squat).toBe(115);
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

describe('Exercise guide under Madcow', () => {
  it('reaches Incline Bench technique from Workout B, unlike the old Customise-only flow', async () => {
    seedHistory({ preset: 'madcow', mcTop: { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 }, mcPress: 'incline' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await user.click(screen.getByText('Workout B'));
    await user.click(screen.getByRole('button', { name: 'How to perform Incline Bench' }));

    const dialog = screen.getByRole('dialog', { name: 'How to perform Incline Bench' });
    expect(within(dialog).getByText('Set bench to 30° angle and lie down with eyes under bar.')).toBeInTheDocument();
  });
});

describe('Stats under Madcow', () => {
  it('lists Incline Bench instead of Overhead Press, and Standard exercises when active', async () => {
    seedHistory({ preset: 'madcow', mcTop: { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 }, mcPress: 'incline' });
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

  it('shows the Madcow top set as the current weight, not the (now separate) Standard weight', async () => {
    seedHistory({
      preset: 'madcow',
      weights: { squat: 90, bench: 60, row: 65, press: 50, deadlift: 100 },
      mcTop: { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 },
      mcPress: 'incline',
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Stats'));
    const squatCard = screen.getByText('Back Squat').closest('button');
    expect(within(squatCard).getByText('107.5kg')).toBeInTheDocument();
  });
});

describe('Program tab week preview', () => {
  it('lets swiping the week card preview weeks 1-4 without changing the live week', async () => {
    seedHistory({ preset: 'madcow', mcTop: { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 }, mcWeek: 5, mcPress: 'incline' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));

    // Past the on-ramp (week 5), the card shows the live week and the real next session.
    // The "back to current week" link is always in the DOM too (both are, so the card
    // never resizes between them), just hidden from sight and screen readers.
    expect(screen.getByText('Week 5')).toBeInTheDocument();
    expect(screen.getByText('Record territory')).toBeInTheDocument();
    expect(screen.getByText(/Next session/)).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('Back to current week')).toHaveAttribute('aria-hidden', 'true');

    const weekCard = screen.getByLabelText('Week progress. Swipe left or right, or use the arrow keys, to preview weeks 1 to 4.');

    // Swiping right (dragging toward an earlier week) previews week 4 -- the note
    // updates, and the live "next session" line is replaced by a way back, not a
    // stale claim about week 4.
    fireEvent.pointerDown(weekCard, { clientX: 200 });
    fireEvent.pointerUp(weekCard, { clientX: 260 });
    expect(screen.getByText('Week 4')).toBeInTheDocument();
    expect(screen.getByText('Matching your best')).toBeInTheDocument();
    expect(screen.getByText(/Next session/)).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Back to current week')).toHaveAttribute('aria-hidden', 'false');

    // Nothing persisted -- this was only ever a preview.
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcWeek).toBe(5);

    // A drag under the swipe threshold doesn't count as a swipe.
    fireEvent.pointerDown(weekCard, { clientX: 200 });
    fireEvent.pointerUp(weekCard, { clientX: 210 });
    expect(screen.getByText('Week 4')).toBeInTheDocument();

    await user.click(screen.getByText('Back to current week'));
    expect(screen.getByText('Week 5')).toBeInTheDocument();
    expect(screen.getByText('Record territory')).toBeInTheDocument();
    expect(screen.getByText(/Next session/)).toHaveAttribute('aria-hidden', 'false');
  });

  it("projects each on-ramp week's own top set into the ramp below, not just the badge", async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await switchToMadcow(user);

    const squatBlock = () => screen.getByRole('button', { name: 'How to perform Back Squat' });
    // Week 1's seeded top set, and its own (not weeks 2-3's) note copy.
    expect(within(squatBlock()).getByText('107.5')).toBeInTheDocument();
    expect(screen.getByText('Deliberately light. 3 more automatic steps before you match your old best in week 4.')).toBeInTheDocument();

    const weekCard = screen.getByLabelText('Week progress. Swipe left or right, or use the arrow keys, to preview weeks 1 to 4.');
    weekCard.focus();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowRight}');

    // On-ramp weeks add one fixed increment per week regardless of performance, so
    // week 3's top set is knowable in advance: 107.5 + 2 * 2.5 = 112.5.
    expect(screen.getByText('Week 3')).toBeInTheDocument();
    expect(within(squatBlock()).getByText('112.5')).toBeInTheDocument();
    // The note's step count also moves, so weeks 1-3 read as distinct copy, not
    // three repeats of the same sentence.
    expect(screen.getByText('Deliberately light. One more automatic step and you match your old best in week 4.')).toBeInTheDocument();
    expect(within(squatBlock()).queryByText('107.5')).not.toBeInTheDocument();
  });

  it('keeps the phase note selectable, unlike the swipeable week label/dots above it', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await switchToMadcow(user);

    const note = screen.getByText(/Deliberately light/);
    expect(note.closest('.select-none')).toBeNull();

    const weekLabel = screen.getByText('Week 1');
    expect(weekLabel.closest('.select-none')).not.toBeNull();
  });

  it('lets keyboard users reach the same preview via arrow keys, since the dots themselves stay non-interactive', async () => {
    seedHistory({ preset: 'madcow', mcTop: { squat: 107.5, bench: 65, row: 70, deadlift: 117.5, press: 55, incline: 50 }, mcWeek: 5, mcPress: 'incline' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    const weekCard = screen.getByLabelText('Week progress. Swipe left or right, or use the arrow keys, to preview weeks 1 to 4.');

    expect(weekCard).toHaveAttribute('tabindex', '0');

    weekCard.focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('Week 4')).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('Week 3')).toBeInTheDocument();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Week 4')).toBeInTheDocument();
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

  it('does not drag a lift down when its Standard weight is already higher than the Madcow top set', async () => {
    seedHistory({
      weights: { squat: 125, bench: 67.5, row: 72.5, press: 55, deadlift: 125 },
      preset: 'madcow',
      mcTop: { squat: 120, bench: 70, row: 75, deadlift: 130, press: 60, incline: 55 },
      mcWeek: 5,
      mcPress: 'incline',
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await user.click(screen.getByLabelText('Choose a program'));
    await user.click(screen.getByText('Standard 5×5'));
    await user.click(screen.getByText('Switch'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // 125 (Standard) beats 120 (the Madcow top set) -- the higher of the two wins.
    expect(stored.weights.squat).toBe(125);
    // Lifts where Madcow's top set is ahead still pick that up.
    expect(stored.weights.deadlift).toBe(130);
  });
});

describe('Returning to a Madcow block in progress', () => {
  it('resumes the saved week and top sets instead of re-seeding the on-ramp', async () => {
    seedHistory({
      preset: 'standard',
      mcSeeded: true,
      mcWeek: 6,
      mcTop: { squat: 130, bench: 72.5, row: 77.5, deadlift: 140, press: 62.5, incline: 60 },
      mcPress: 'incline',
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await user.click(screen.getByLabelText('Choose a program'));
    await user.click(screen.getByText('Madcow 5×5'));
    await user.click(screen.getByText('Switch'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.mcWeek).toBe(6);
    expect(stored.mcTop.squat).toBe(130);
    expect(screen.getByText('Week 6')).toBeInTheDocument();
  });
});

describe('Round-tripping between programs', () => {
  it('a there-and-back switch leaves every Standard weight untouched', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await switchToMadcow(user);
    await user.click(screen.getByLabelText('Choose a program'));
    await user.click(screen.getByText('Standard 5×5'));
    await user.click(screen.getByText('Switch'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.preset).toBe('standard');
    expect(stored.weights).toMatchObject({ squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125 });
  });

  it('repeated switching does not erode the weights', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    for (let i = 0; i < 3; i++) {
      await switchToMadcow(user);
      await user.click(screen.getByLabelText('Choose a program'));
      await user.click(screen.getByText('Standard 5×5'));
      await user.click(screen.getByText('Switch'));
    }

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights).toMatchObject({ squat: 115, bench: 67.5, row: 72.5, press: 55, deadlift: 125 });
  });

  it('a Madcow block with incline never moves the overhead press', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await switchToMadcow(user);
    await user.click(screen.getByLabelText('Choose a program'));
    await user.click(screen.getByText('Standard 5×5'));
    await user.click(screen.getByText('Switch'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.press).toBe(55);
  });
});
