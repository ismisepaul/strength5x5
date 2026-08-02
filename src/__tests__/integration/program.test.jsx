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

const benchCard = () => within(screen.getByText('Bench Press').closest('.p-6'));

describe('Program tab', () => {
  it('reduces the number of live set buttons for an exercise set below 5', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
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
    await user.click(benchCard().getByLabelText('Decrease bench sets'));
    unmount();

    render(<App />);
    await user.click(screen.getByLabelText('Program'));
    const benchSets = benchCard().getByText('4');
    expect(benchSets).toBeInTheDocument();
  });

  it('resets to defaults', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Program'));
    await user.click(benchCard().getByLabelText('Decrease bench sets'));
    await user.click(screen.getByText('Reset'));

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

  it('logs 0 reps via the picker, distinct from the short-press cycle which never shows 0', async () => {
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
  it('never shows 0 -- from 1 rep it clears straight back to unlogged', async () => {
    seedHistory();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));

    const firstSet = screen.getAllByLabelText('Set 1')[0];
    // Cycle: unlogged -> 5 -> 4 -> 3 -> 2 -> 1 -> unlogged (skips 0 entirely).
    for (let i = 0; i < 5; i++) {
      await user.click(firstSet);
    }
    expect(firstSet).toHaveAttribute('aria-label', 'Set 1, 1 reps');

    await user.click(firstSet);
    expect(firstSet).toHaveAttribute('aria-label', 'Set 1');
  });
});
