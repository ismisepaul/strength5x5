import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { STORAGE_KEY } from '../../constants';

const workoutData = {
  version: 1,
  weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
  history: [{ date: new Date().toISOString(), type: 'A', exercises: [] }],
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

describe('Skip button behavior', () => {
  it('skip during countdown transitions to lifting state instead of dismissing', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });
    await user.click(setButtons[0]);

    expect(screen.getByText('Recovery Phase')).toBeInTheDocument();
    expect(screen.getByText('Skip')).toBeInTheDocument();

    await user.click(screen.getByText('Skip'));

    expect(screen.getByText('Lifting')).toBeInTheDocument();
    expect(screen.queryByText('Recovery Phase')).not.toBeInTheDocument();
  });

  it('Got it on exercise complete fully dismisses the timer bar', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });

    for (let i = 0; i < 5; i++) {
      await user.click(setButtons[i]);
    }

    expect(screen.getByText('Movement Finished')).toBeInTheDocument();
    await user.click(screen.getByText('Got it'));

    expect(screen.queryByText('Movement Finished')).not.toBeInTheDocument();
    expect(screen.queryByText('Lifting')).not.toBeInTheDocument();
    expect(screen.queryByText('Recovery Phase')).not.toBeInTheDocument();
  });
});

describe('Nav collapse during workout', () => {
  it('shows collapsed nav (menu icon) during an active workout on workout tab', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));

    expect(screen.getByLabelText('Show navigation')).toBeInTheDocument();
    expect(screen.queryByLabelText('Train')).not.toBeInTheDocument();
  });

  it('expands full nav when menu icon is clicked', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByLabelText('Show navigation'));

    expect(screen.getByLabelText('Train')).toBeInTheDocument();
    expect(screen.getByLabelText('Log')).toBeInTheDocument();
    expect(screen.getByLabelText('Stats')).toBeInTheDocument();
    expect(screen.getByLabelText('Options')).toBeInTheDocument();
  });

  it('collapses nav when returning to workout tab from another tab', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByLabelText('Show navigation'));
    await user.click(screen.getByLabelText('Log'));

    expect(screen.getByText('Workout Log')).toBeInTheDocument();
    expect(screen.getByLabelText('Train')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Train'));

    expect(screen.getByLabelText('Show navigation')).toBeInTheDocument();
    expect(screen.queryByLabelText('Log')).not.toBeInTheDocument();
  });

  it('collapses nav when toggling a set during workout', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByLabelText('Show navigation'));

    expect(screen.getByLabelText('Train')).toBeInTheDocument();

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });
    await user.click(setButtons[0]);

    expect(screen.getByLabelText('Show navigation')).toBeInTheDocument();
  });

  it('shows full nav before workout starts', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    render(<App />);

    expect(screen.getByLabelText('Train')).toBeInTheDocument();
    expect(screen.getByLabelText('Log')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show navigation')).not.toBeInTheDocument();
  });
});

describe('Live Session bar', () => {
  it('shows Live Session bar when navigating away during a workout', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByLabelText('Show navigation'));
    await user.click(screen.getByLabelText('Log'));

    expect(screen.getByText('Live Session')).toBeInTheDocument();
    expect(screen.getByText('Return')).toBeInTheDocument();
  });

  it('returns to workout tab when Live Session bar is clicked', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByLabelText('Show navigation'));
    await user.click(screen.getByLabelText('Log'));

    await user.click(screen.getByText('Return'));

    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.queryByText('Workout Log')).not.toBeInTheDocument();
  });
});

describe('System dark mode preference', () => {
  it('defaults to system preference when no saved isDark', () => {
    render(<App />);
    expect(screen.getByLabelText('Switch to light mode')).toBeInTheDocument();
  });

  it('respects saved light mode preference over system default', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...workoutData,
      isDark: false,
    }));
    render(<App />);
    expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument();
  });
});

const statsData = {
  version: 1,
  weights: { squat: 55, bench: 42.5, row: 42.5, press: 30, deadlift: 65 },
  history: [
    { date: '2024-01-15T12:00:00.000Z', type: 'B', exercises: [
      { id: 'squat', name: 'Back Squat', weight: 55, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
      { id: 'press', name: 'Overhead Press', weight: 30, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,3] },
      { id: 'deadlift', name: 'Deadlift', weight: 65, sets: 1, reps: 5, increment: 5, setsCompleted: [5] },
    ]},
    { date: '2024-01-12T12:00:00.000Z', type: 'A', exercises: [
      { id: 'squat', name: 'Back Squat', weight: 52.5, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
      { id: 'bench', name: 'Bench Press', weight: 42.5, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
      { id: 'row', name: 'Barbell Row', weight: 42.5, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
    ]},
  ],
  nextType: 'A',
  isDark: true,
  autoSave: false,
  preferredRest: 90,
  soundEnabled: false,
  vibrationEnabled: false,
};

describe('Stats charts', () => {
  it('tapping an exercise card in Stats shows chart view', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('Back Squat'));

    expect(screen.getByLabelText('Back to stats')).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('Est. 1RM')).toBeInTheDocument();
  });

  it('tapping back returns to list view', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('Back Squat'));
    await user.click(screen.getByLabelText('Back to stats'));

    expect(screen.getByText('Peak Stats')).toBeInTheDocument();
  });

  it('tapping Big 3 Total shows chart view', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('Peak Stats'));

    expect(screen.getByText('Big 3 Total')).toBeInTheDocument();
    expect(screen.getByLabelText('Back to stats')).toBeInTheDocument();
  });

  it('shows trend arrows on exercise cards', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByText('Stats'));

    const chevrons = container.querySelectorAll('.lucide-chevron-right');
    expect(chevrons.length).toBeGreaterThanOrEqual(5);
  });

  it('Weight toggle is on by default and Est. 1RM can be toggled on independently', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('Back Squat'));

    const weightBtn = screen.getByText('Weight').closest('button');
    const e1rmBtn = screen.getByText('Est. 1RM').closest('button');

    expect(weightBtn.className).toContain('bg-indigo-600');
    expect(e1rmBtn.className).not.toContain('bg-emerald-600');

    await user.click(e1rmBtn);
    expect(e1rmBtn.className).toContain('bg-emerald-600');
    expect(weightBtn.className).toContain('bg-indigo-600');
  });

  it('time range pills are present in chart view', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('Back Squat'));

    expect(screen.getByText('1M')).toBeInTheDocument();
    expect(screen.getByText('3M')).toBeInTheDocument();
    expect(screen.getByText('6M')).toBeInTheDocument();
    expect(screen.getByText('1Y')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });
});

describe('Log entry editing', () => {
  const logData = {
    version: 1,
    weights: { squat: 55, bench: 42.5, row: 42.5, press: 30, deadlift: 65 },
    history: [
      { date: '2024-01-15T12:00:00.000Z', type: 'B', exercises: [
        { id: 'squat', name: 'Back Squat', weight: 55, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
        { id: 'press', name: 'Overhead Press', weight: 30, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,3] },
        { id: 'deadlift', name: 'Deadlift', weight: 65, sets: 1, reps: 5, increment: 5, setsCompleted: [5] },
      ]},
      { date: '2024-01-12T12:00:00.000Z', type: 'A', exercises: [
        { id: 'squat', name: 'Back Squat', weight: 52.5, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
        { id: 'bench', name: 'Bench Press', weight: 42.5, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
        { id: 'row', name: 'Barbell Row', weight: 42.5, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
      ]},
    ],
    nextType: 'A',
    isDark: true,
    autoSave: false,
    preferredRest: 90,
    soundEnabled: false,
    vibrationEnabled: false,
  };

  it('tapping a log entry opens the edit modal', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cards = screen.getAllByText(/Workout [AB]/);
    await user.click(cards[0].closest('button'));

    expect(screen.getByLabelText('Edit workout')).toBeInTheDocument();
    expect(screen.getByText('Edit Workout')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('changing weight and saving persists the change', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cards = screen.getAllByText(/Workout [AB]/);
    await user.click(cards[0].closest('button'));

    const increaseButtons = screen.getAllByLabelText(/Increase .+ weight/);
    await user.click(increaseButtons[0]);

    await user.click(screen.getByText('Save Changes'));

    expect(screen.queryByLabelText('Edit workout')).not.toBeInTheDocument();
    expect(screen.getByText('57.5kg')).toBeInTheDocument();
  });

  it('deleting an entry removes it from history', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cardsBefore = screen.getAllByText(/Workout [AB]/);
    expect(cardsBefore).toHaveLength(2);

    await user.click(cardsBefore[0].closest('button'));
    await user.click(screen.getByText('Delete Workout'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.queryByLabelText('Edit workout')).not.toBeInTheDocument();
    const cardsAfter = screen.getAllByText(/Workout [AB]/);
    expect(cardsAfter).toHaveLength(1);
  });

  it('cancelling edit discards changes', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cards = screen.getAllByText(/Workout [AB]/);
    await user.click(cards[0].closest('button'));

    const increaseButtons = screen.getAllByLabelText(/Increase .+ weight/);
    await user.click(increaseButtons[0]);

    await user.click(screen.getByLabelText('Close edit modal'));

    expect(screen.queryByLabelText('Edit workout')).not.toBeInTheDocument();
    expect(screen.getByText('55kg')).toBeInTheDocument();
    expect(screen.queryByText('57.5kg')).not.toBeInTheDocument();
  });
});
