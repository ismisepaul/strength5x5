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

describe('Workout Flow', () => {
  it('starts a workout session when history exists', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
      nextType: 'A',
      isDark: true,
      autoSave: false,
      preferredRest: 90,
      soundEnabled: false,
      vibrationEnabled: false,
    }));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Barbell Row')).toBeInTheDocument();
  });

  it('completes all sets and finishes workout with weight increment', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
      nextType: 'A',
      isDark: true,
      autoSave: false,
      preferredRest: 90,
      soundEnabled: false,
      vibrationEnabled: false,
    }));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });

    for (const btn of setButtons) {
      await user.click(btn);
    }

    const finishBtn = screen.getByText('Finish Session');
    expect(finishBtn).not.toBeDisabled();
    await user.click(finishBtn);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(62.5);
    expect(stored.weights.bench).toBe(47.5);
    expect(stored.weights.row).toBe(52.5);
    expect(stored.history).toHaveLength(2);
  });

  it('does not increment weight for failed sets', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
      nextType: 'A',
      isDark: true,
      autoSave: false,
      preferredRest: 90,
      soundEnabled: false,
      vibrationEnabled: false,
    }));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });

    // Click set 1 of first exercise (squat) -- marks as 5
    await user.click(setButtons[0]);
    // Click again to decrement to 4 (failed)
    await user.click(setButtons[0]);

    // Complete all remaining sets with single click (marks as 5)
    for (let i = 1; i < setButtons.length; i++) {
      await user.click(setButtons[i]);
    }

    await user.click(screen.getByText('Finish Session'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Squat should NOT have incremented because set 1 was 4, not 5
    expect(stored.weights.squat).toBe(60);
    // Bench and Row should have incremented
    expect(stored.weights.bench).toBe(47.5);
    expect(stored.weights.row).toBe(52.5);
  });

  it('shows restore prompt when no history', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    expect(screen.getByText('Sync History?')).toBeInTheDocument();
  });

  it('can skip restore and start fresh', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByText('Skip and start fresh'));
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
  });

  it('can discard a workout', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
      nextType: 'A',
      isDark: true,
      autoSave: false,
      preferredRest: 90,
      soundEnabled: false,
      vibrationEnabled: false,
    }));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByText('Discard Workout'));
    expect(screen.getByText('Discard session?')).toBeInTheDocument();
    await user.click(screen.getByText('Yes, Discard Everything'));
    expect(screen.getByText('Start Session')).toBeInTheDocument();
  });
});
