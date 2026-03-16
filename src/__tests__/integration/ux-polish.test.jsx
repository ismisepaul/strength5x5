import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { STORAGE_KEY, ACTIVE_WORKOUT_KEY } from '../../constants';

const yesterdayISO = new Date(Date.now() - 86400000).toISOString();

const workoutData = {
  version: 1,
  weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
  history: [{ date: yesterdayISO, type: 'A', exercises: [
    { id: 'squat', name: 'Back Squat', weight: 57.5, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 5, 5] },
    { id: 'bench', name: 'Bench Press', weight: 42.5, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 5, 5] },
    { id: 'row', name: 'Barbell Row', weight: 47.5, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 5, 5] },
  ] }],
  nextType: 'A',
  isDark: true,
  autoSave: false,
  preferredRest: 90,
  soundEnabled: false,
  vibrationEnabled: false,
};

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

describe('Toast notifications', () => {
  it('shows error toast when import file has invalid structure', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<App />);

    await user.click(screen.getByText('Options'));

    const fileInput = document.querySelector('input[accept=".json"]');
    const invalidFile = new File(['{"bad": "data"}'], 'test.json', { type: 'application/json' });
    await user.upload(fileInput, invalidFile);

    await waitFor(() => {
      expect(screen.getByText('Invalid backup file')).toBeInTheDocument();
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('shows success toast when editing a workout', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Log'));
    const workoutCards = screen.getAllByText(/Workout A/i);
    await user.click(workoutCards[0].closest('button'));

    const dialog = screen.getByRole('dialog');
    const saveBtn = dialog.querySelector('button');
    const allBtns = dialog.querySelectorAll('button');
    const save = Array.from(allBtns).find(b => b.textContent === 'Save Changes');
    await user.click(save);

    await waitFor(() => {
      expect(screen.getByText('Workout updated')).toBeInTheDocument();
    });
  });

  it('shows success toast when deleting a workout', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Log'));
    const workoutCards = screen.getAllByText(/Workout A/i);
    await user.click(workoutCards[0].closest('button'));

    await user.click(screen.getByText('Delete Workout'));
    const deleteBtn = screen.getByRole('button', { name: /^Delete$/i });
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Workout deleted')).toBeInTheDocument();
    });
  });
});

describe('Workout completion summary', () => {
  it('shows completion modal with exercise results after finishing workout', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
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

    await user.click(screen.getByText('Finish Workout'));

    await waitFor(() => {
      expect(screen.getByText(/Complete/i)).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog', { name: 'Workout complete' });
    expect(dialog).toHaveTextContent('Back Squat');
    expect(dialog).toHaveTextContent('Bench Press');
    expect(dialog).toHaveTextContent('Barbell Row');
  });

  it('dismisses completion summary when Done is clicked', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
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
    await user.click(screen.getByText('Finish Workout'));

    await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
    await user.click(screen.getByText('Done'));

    await waitFor(() => {
      expect(screen.queryByText('Done')).not.toBeInTheDocument();
    });
  });
});

describe('Workout recovery', () => {
  it('shows resume prompt when active workout exists in localStorage', async () => {
    const activeSession = {
      session: {
        date: new Date().toISOString(),
        type: 'A',
        startedAt: Date.now() - 600000,
        exercises: [
          { id: 'squat', name: 'Back Squat', weight: 60, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, 5, null, null, null] },
          { id: 'bench', name: 'Bench Press', weight: 45, sets: 5, reps: 5, increment: 2.5, setsCompleted: [null, null, null, null, null] },
          { id: 'row', name: 'Barbell Row', weight: 50, sets: 5, reps: 5, increment: 2.5, setsCompleted: [null, null, null, null, null] },
        ],
      },
      restTimerEndTime: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(activeSession));
    render(<App />);

    expect(screen.getByText('Resume Workout?')).toBeInTheDocument();
    expect(screen.getByText(/2 of 15 sets completed/)).toBeInTheDocument();
  });

  it('auto-discards workouts older than 24 hours', () => {
    const staleSession = {
      session: {
        date: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        type: 'A',
        exercises: [],
      },
      restTimerEndTime: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(staleSession));
    render(<App />);

    expect(screen.queryByText('Resume Workout?')).not.toBeInTheDocument();
    expect(localStorage.getItem(ACTIVE_WORKOUT_KEY)).toBeNull();
  });

  it('resumes workout when Resume is clicked', async () => {
    const activeSession = {
      session: {
        date: new Date().toISOString(),
        type: 'A',
        startedAt: Date.now() - 300000,
        exercises: [
          { id: 'squat', name: 'Back Squat', weight: 60, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5, null, null, null, null] },
          { id: 'bench', name: 'Bench Press', weight: 45, sets: 5, reps: 5, increment: 2.5, setsCompleted: [null, null, null, null, null] },
          { id: 'row', name: 'Barbell Row', weight: 50, sets: 5, reps: 5, increment: 2.5, setsCompleted: [null, null, null, null, null] },
        ],
      },
      restTimerEndTime: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(activeSession));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Resume'));

    await waitFor(() => {
      expect(screen.queryByText('Resume Workout?')).not.toBeInTheDocument();
      expect(screen.getByText('Finish Workout')).toBeInTheDocument();
    });
  });

  it('clears active workout when Discard is clicked', async () => {
    const activeSession = {
      session: {
        date: new Date().toISOString(),
        type: 'A',
        exercises: [
          { id: 'squat', name: 'Back Squat', weight: 60, sets: 5, reps: 5, increment: 2.5, setsCompleted: [null, null, null, null, null] },
        ],
      },
      restTimerEndTime: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(activeSession));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Discard'));

    await waitFor(() => {
      expect(screen.queryByText('Resume Workout?')).not.toBeInTheDocument();
    });
    expect(localStorage.getItem(ACTIVE_WORKOUT_KEY)).toBeNull();
  });
});

describe('logGrouping persistence', () => {
  it('persists logGrouping to localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Log'));
    await user.click(screen.getByText('Month'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.logGrouping).toBe('month');
  });
});
