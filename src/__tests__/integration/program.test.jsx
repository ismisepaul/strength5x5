import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { STORAGE_KEY } from '../../constants';

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

function seedHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
    history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
    nextType: 'A',
    isDark: true,
    autoSave: false,
    preferredRest: 90,
    soundEnabled: false,
    vibrationEnabled: false,
  }));
}

// After opening the customise disclosure, "Bench Press" appears twice: once in the
// preview card above, once as the customiser's own bordered exercise card.
const benchCard = () => within(screen.getAllByText('Bench Press').at(-1).closest('.border'));
const openCustomise = (user) => user.click(screen.getByText('Customise sets and reps'));

describe('Program tab', () => {
  it('reduces the number of live set buttons for an exercise set below 5', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await openCustomise(user);
    await user.click(benchCard().getByLabelText('Decrease bench sets'));
    await user.click(benchCard().getByLabelText('Decrease bench sets'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.program.bench.sets).toBe(3);

    await user.click(screen.getByLabelText('Train'));
    await user.click(screen.getByText('Start workout'));

    const benchSetButtons = benchCard().getAllByRole('button').filter(btn => (btn.getAttribute('aria-label') || '').startsWith('Set '));
    expect(benchSetButtons).toHaveLength(3);
  });

  it('progresses the weight when all sets hit a customized rep target', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await openCustomise(user);
    await user.click(benchCard().getByLabelText('Decrease bench reps'));
    await user.click(benchCard().getByLabelText('Decrease bench reps'));

    let stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.program.bench.reps).toBe(3);

    await user.click(screen.getByLabelText('Train'));
    await user.click(screen.getByText('Start workout'));

    const benchButtons = benchCard().getAllByRole('button').filter(btn => (btn.getAttribute('aria-label') || '').startsWith('Set '));
    // Each set cycles target -> target-1 -> ... -> unlogged; one tap logs the 3-rep target.
    for (const btn of benchButtons) {
      await user.click(btn);
    }

    const squatButtons = screen.getAllByRole('button').filter(btn => (btn.getAttribute('aria-label') || '').startsWith('Set '));
    for (const btn of squatButtons) {
      if (!benchButtons.includes(btn)) await user.click(btn);
    }

    await user.click(screen.getByText('Finish workout'));

    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.bench).toBe(47.5);
  });

  it('persists program changes across a remount', async () => {
    seedHistory();
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await openCustomise(user);
    await user.click(benchCard().getByLabelText('Decrease bench sets'));
    unmount();

    render(<App />);
    await user.click(screen.getByLabelText('Program'));
    await openCustomise(user);
    const benchSets = benchCard().getByText('4');
    expect(benchSets).toBeInTheDocument();
  });

  it('toggles the how-to-perform accordion independently per exercise', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await openCustomise(user);

    expect(benchCard().queryByText('Lie on the bench with your eyes under the bar.')).not.toBeInTheDocument();

    await user.click(benchCard().getByText('How to perform'));
    expect(benchCard().getByText('Lie on the bench with your eyes under the bar.')).toBeInTheDocument();
    expect(benchCard().getByText('Rack the bar securely after the final rep.')).toBeInTheDocument();

    const squatCard = () => within(screen.getAllByText('Back Squat').at(-1).closest('.border'));
    expect(squatCard().queryByText('Set the bar on your upper back and unrack it.')).not.toBeInTheDocument();

    await user.click(benchCard().getByText('How to perform'));
    expect(benchCard().queryByText('Lie on the bench with your eyes under the bar.')).not.toBeInTheDocument();
  });

  it('resets to defaults', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await openCustomise(user);
    await user.click(benchCard().getByLabelText('Decrease bench sets'));
    await user.click(screen.getByText('Reset to 5×5'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.program.bench.sets).toBe(5);
  });
});

describe('Rep picker', () => {
  it('long-pressing a set opens a picker that logs the chosen rep count', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));

    const firstSet = screen.getAllByLabelText('Set 1')[0];
    fireEvent.pointerDown(firstSet);
    await new Promise(resolve => setTimeout(resolve, 550));

    expect(screen.getByRole('dialog', { name: 'Rep picker' })).toBeInTheDocument();
    await user.click(screen.getByLabelText('3 reps'));

    expect(screen.getByLabelText('Set 1, 3 reps')).toBeInTheDocument();
  });

  it('logs 0 reps via the picker', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));

    const firstSet = screen.getAllByLabelText('Set 1')[0];
    fireEvent.pointerDown(firstSet);
    await new Promise(resolve => setTimeout(resolve, 550));
    await user.click(screen.getByLabelText('0 reps'));

    expect(screen.getByLabelText('Set 1, 0 reps')).toBeInTheDocument();
  });
});

describe('Short-press set cycle', () => {
  it('reaches 0 before clearing back to unlogged', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));

    const firstSet = screen.getAllByLabelText('Set 1')[0];
    // Cycle: unlogged -> 5 -> 4 -> 3 -> 2 -> 1 -> 0 -> unlogged.
    for (let i = 0; i < 6; i++) {
      await user.click(firstSet);
    }
    expect(firstSet).toHaveAttribute('aria-label', 'Set 1, 0 reps');

    await user.click(firstSet);
    expect(firstSet).toHaveAttribute('aria-label', 'Set 1');
  });
});
