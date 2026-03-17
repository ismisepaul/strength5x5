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
  it('starts a workout when history exists', async () => {
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

    await user.click(screen.getByText('Start Workout'));
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Barbell Row')).toBeInTheDocument();
  });

  it('shows static weights before starting workout', () => {
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

    render(<App />);

    expect(screen.queryByLabelText(/Decrease .* weight/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Increase .* weight/)).not.toBeInTheDocument();
    expect(screen.getByText('60kg')).toBeInTheDocument();
    expect(screen.getByText('45kg')).toBeInTheDocument();
    expect(screen.getByText('50kg')).toBeInTheDocument();
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

    await user.click(screen.getByText('Start Workout'));

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });

    for (const btn of setButtons) {
      await user.click(btn);
    }

    const finishBtn = screen.getByText('Finish Workout');
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

    await user.click(screen.getByText('Start Workout'));

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

    await user.click(screen.getByText('Finish Workout'));

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

    await user.click(screen.getByText('Start Workout'));
    expect(screen.getByText('Sync History?')).toBeInTheDocument();
  });

  it('can skip restore and start fresh', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Workout'));
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

    await user.click(screen.getByText('Start Workout'));
    await user.click(screen.getByText('Discard Workout'));
    expect(screen.getByText('Discard workout?')).toBeInTheDocument();
    await user.click(screen.getByText('Yes, Discard Everything'));
    expect(screen.getByText('Start Workout')).toBeInTheDocument();
  });

  it('shows deload slider after 3 consecutive failures and applies on confirm', async () => {
    const failedSession = (daysAgo) => ({
      date: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      type: 'A',
      exercises: [
        { id: 'squat', name: 'Back Squat', weight: 60, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 3, 2] },
        { id: 'bench', name: 'Bench Press', weight: 45, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 5, 5] },
        { id: 'row', name: 'Barbell Row', weight: 50, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 5, 5] },
      ],
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [failedSession(3), failedSession(5)],
      nextType: 'A',
      isDark: true,
      autoSave: false,
      preferredRest: 90,
      soundEnabled: false,
      vibrationEnabled: false,
    }));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Workout'));

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });

    await user.click(setButtons[0]);
    await user.click(setButtons[0]);
    for (let i = 1; i < 5; i++) {
      await user.click(setButtons[i]);
    }

    for (let i = 5; i < setButtons.length; i++) {
      await user.click(setButtons[i]);
    }

    await user.click(screen.getByText('Finish Workout'));

    expect(screen.getByText(/Deload needed/)).toBeInTheDocument();

    let stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(60);
    expect(stored.weights.bench).toBe(47.5);
    expect(stored.weights.row).toBe(52.5);

    await user.click(screen.getByText('Done'));

    expect(screen.queryByText('Deload Needed')).not.toBeInTheDocument();
    expect(screen.getByText('Already trained today')).toBeInTheDocument();
  });

  it('shows failure deload on start and applies deloaded weights', async () => {
    const failedSession = (daysAgo) => ({
      date: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      type: 'A',
      exercises: [
        { id: 'squat', name: 'Back Squat', weight: 60, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 3, 2] },
        { id: 'bench', name: 'Bench Press', weight: 45, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 5, 5] },
        { id: 'row', name: 'Barbell Row', weight: 50, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 5, 5] },
      ],
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [failedSession(1), failedSession(3), failedSession(5)],
      nextType: 'A',
      isDark: true,
      autoSave: false,
      preferredRest: 90,
      soundEnabled: false,
      vibrationEnabled: false,
    }));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Workout'));
    expect(screen.getByText('Deload Needed')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByText('Recommended: 10%')).toBeInTheDocument();

    await user.click(screen.getByText('Apply Deload'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(55);
    expect(screen.getByText('Finish Workout')).toBeInTheDocument();
  });

  it('shows failure deload on start and skips into workout without changing weight', async () => {
    const failedSession = (daysAgo) => ({
      date: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      type: 'A',
      exercises: [
        { id: 'squat', name: 'Back Squat', weight: 60, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 3, 2] },
        { id: 'bench', name: 'Bench Press', weight: 45, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 5, 5] },
        { id: 'row', name: 'Barbell Row', weight: 50, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 5, 5] },
      ],
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [failedSession(3), failedSession(5), failedSession(7)],
      nextType: 'A',
      isDark: true,
      autoSave: false,
      preferredRest: 90,
      soundEnabled: false,
      vibrationEnabled: false,
    }));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Workout'));
    expect(screen.getByText('Deload Needed')).toBeInTheDocument();

    await user.click(screen.getByText('Skip Deload'));
    expect(screen.getByText('Finish Workout')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(60);
  });
});
