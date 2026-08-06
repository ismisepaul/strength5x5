import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { STORAGE_KEY } from '../../constants';

const workoutData = {
  version: 1,
  weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
  history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
  nextType: 'A',
  isDark: true,
  autoSave: false,
  preferredRest: 90,
  soundEnabled: false,
  vibrationEnabled: false,
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty('--app-page-bg');
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

describe('Skip button behavior', () => {
  it('skip during countdown transitions to lifting state instead of dismissing', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });
    await user.click(setButtons[0]);

    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByLabelText('Skip rest')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Skip rest'));

    expect(screen.getByText('Lifting')).toBeInTheDocument();
    expect(screen.queryByText('Rest')).not.toBeInTheDocument();
  });

  it('Got it on exercise complete fully dismisses the timer bar', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });

    for (let i = 0; i < 5; i++) {
      await user.click(setButtons[i]);
    }

    expect(screen.getByText('Movement finished')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Dismiss'));

    expect(screen.queryByText('Movement finished')).not.toBeInTheDocument();
    expect(screen.queryByText('Lifting')).not.toBeInTheDocument();
    expect(screen.getByText('In session')).toBeInTheDocument();
  });
});

describe('Tab bar during an active workout', () => {
  it('keeps all five tabs visible during an active workout on the workout tab', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));

    expect(screen.getByLabelText('Train')).toBeInTheDocument();
    expect(screen.getByLabelText('Program')).toBeInTheDocument();
    expect(screen.getByLabelText('Log')).toBeInTheDocument();
    expect(screen.getByLabelText('Stats')).toBeInTheDocument();
    expect(screen.getByLabelText('Options')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show navigation')).not.toBeInTheDocument();
  });

  it('returns to the live workout when returning to the Train tab from another tab', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));
    await user.click(screen.getByLabelText('Log'));

    expect(screen.getByRole('heading', { name: 'Log' })).toBeInTheDocument();
    expect(screen.getByLabelText('Train')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Train'));

    expect(screen.queryByRole('heading', { name: 'Log' })).not.toBeInTheDocument();
    expect(screen.queryByText('Start workout')).not.toBeInTheDocument();
    expect(screen.getByText('Finish workout')).toBeInTheDocument();
  });

  it('keeps the tab bar visible while toggling a set during a workout', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });
    await user.click(setButtons[0]);

    expect(screen.getByLabelText('Train')).toBeInTheDocument();
    expect(screen.getByLabelText('Log')).toBeInTheDocument();
  });

  it('shows full nav before workout starts', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    render(<App />);

    expect(screen.getByLabelText('Train')).toBeInTheDocument();
    expect(screen.getByLabelText('Log')).toBeInTheDocument();
    expect(screen.queryByLabelText('Show navigation')).not.toBeInTheDocument();
  });
});

describe('Live Workout bar', () => {
  it('shows Live Workout bar when navigating away during a workout', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));
    await user.click(screen.getByLabelText('Log'));

    expect(screen.getByText('Workout in progress')).toBeInTheDocument();
    expect(screen.getByText('Return')).toBeInTheDocument();
  });

  it('returns to workout tab when Live Workout bar is clicked', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start workout'));
    await user.click(screen.getByLabelText('Log'));

    await user.click(screen.getByText('Return'));

    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Log' })).not.toBeInTheDocument();
  });
});

describe('System dark mode preference', () => {
  it('defaults to system preference when no saved isDark', () => {
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--app-page-bg')).toBe('#141310');
  });

  it('respects saved light mode preference over system default', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...workoutData,
      isDark: false,
    }));
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--app-page-bg')).toBe('#f7f4ef');
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
    await user.click(screen.getByText('Back Squat', { selector: 'p.text-card' }));

    expect(screen.getByLabelText('Back to stats')).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('Est. 1RM')).toBeInTheDocument();
  });

  it('tapping back returns to list view', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('Back Squat', { selector: 'p.text-card' }));
    await user.click(screen.getByLabelText('Back to stats'));

    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument();
  });

  it('tapping Big 3 Total shows chart view', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('Big-3 total'));

    expect(screen.getByText('Big-3 total')).toBeInTheDocument();
    expect(screen.getByLabelText('Back to stats')).toBeInTheDocument();
  });

  it('every exercise card stays tappable into its chart view', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));

    const exerciseNames = ['Back Squat', 'Bench Press', 'Barbell Row', 'Overhead Press', 'Deadlift'];
    for (const name of exerciseNames) {
      const row = screen.getByText(name, { selector: 'p.text-card' }).closest('button');
      expect(row.querySelector('svg')).toBeTruthy();
    }
  });

  it('renders a sparkline only for lifts with at least two logged sessions', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    // Fixture dates are long past any recent range -- widen it so the sparklines
    // being tested here actually have points to draw from.
    await user.click(screen.getByText('All'));

    const squatRow = screen.getByText('Back Squat', { selector: 'p.text-card' }).closest('button');
    expect(squatRow.querySelector('polyline')).toBeTruthy();

    const benchRow = screen.getByText('Bench Press', { selector: 'p.text-card' }).closest('button');
    expect(benchRow.querySelector('polyline')).toBeFalsy();
  });

  it('Weight toggle is on by default and Est. 1RM can be toggled on independently', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('Back Squat', { selector: 'p.text-card' }));

    const weightBtn = screen.getByText('Weight').closest('button');
    const e1rmBtn = screen.getByText('Est. 1RM').closest('button');

    expect(weightBtn).toHaveAttribute('aria-pressed', 'true');
    expect(e1rmBtn).toHaveAttribute('aria-pressed', 'false');
    expect(weightBtn.className).toContain('border-accent');

    await user.click(e1rmBtn);
    expect(e1rmBtn).toHaveAttribute('aria-pressed', 'true');
    expect(e1rmBtn.className).toContain('border-accent');
    expect(weightBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('time range pills are present in chart view', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('Back Squat', { selector: 'p.text-card' }));

    expect(screen.getByText('1M')).toBeInTheDocument();
    expect(screen.getByText('3M')).toBeInTheDocument();
    expect(screen.getByText('6M')).toBeInTheDocument();
    expect(screen.getByText('1Y')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('shows the since/delta summary and the best-set/volume/misses row', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('All'));
    await user.click(screen.getByText('Back Squat', { selector: 'p.text-card' }));

    expect(screen.getByText(/^Since /)).toBeInTheDocument();
    expect(screen.getByText('Best set')).toBeInTheDocument();
    expect(screen.getByText('55kg × 5')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
    expect(screen.getByText('Misses')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('keeps the chosen range selected across the list-to-detail transition', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statsData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Stats'));
    await user.click(screen.getByText('1Y'));
    expect(screen.getByText('1Y').closest('button').className).toContain('bg-accent-900');

    await user.click(screen.getByText('Back Squat', { selector: 'p.text-card' }));
    expect(screen.getByText('1Y').closest('button').className).toContain('bg-accent-900');

    await user.click(screen.getByLabelText('Back to stats'));
    expect(screen.getByText('1Y').closest('button').className).toContain('bg-accent-900');
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

  it('tapping a log entry expands it in place, and Edit opens the edit modal', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cards = screen.getAllByText(/Workout [AB]/);
    await user.click(cards[0].closest('button'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByText('Edit workout'));

    expect(screen.getByLabelText('Edit workout')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('collapses an expanded entry on a second tap', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const card = screen.getAllByText(/Workout [AB]/)[0].closest('button');
    await user.click(card);
    expect(screen.getByText('Edit workout')).toBeInTheDocument();

    await user.click(card);
    expect(screen.queryByText('Edit workout')).not.toBeInTheDocument();
  });

  it('changing weight and saving persists the change', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cards = screen.getAllByText(/Workout [AB]/);
    await user.click(cards[0].closest('button'));
    await user.click(screen.getByText('Edit workout'));

    const increaseButtons = screen.getAllByLabelText(/Increase .+ weight/);
    await user.click(increaseButtons[0]);

    await user.click(screen.getByText('Save Changes'));

    expect(screen.queryByLabelText('Edit workout')).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.history[0].exercises[0].weight).toBe(57.5);
  });

  it('deleting an entry removes it from history, directly from the row expansion', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cardsBefore = screen.getAllByText(/Workout [AB]/);
    expect(cardsBefore).toHaveLength(2);

    await user.click(cardsBefore[0].closest('button'));
    await user.click(screen.getByText('Delete Workout'));

    expect(screen.getByText('Keep session')).toBeInTheDocument();
    await user.click(screen.getByText('Delete anyway'));

    expect(screen.queryByText('Keep session')).not.toBeInTheDocument();
    const cardsAfter = screen.getAllByText(/Workout [AB]/);
    expect(cardsAfter).toHaveLength(1);
  });

  it('keeping a session dismisses the delete confirm without deleting anything', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getAllByText(/Workout [AB]/)[0].closest('button'));
    await user.click(screen.getByText('Delete Workout'));

    await user.click(screen.getByText('Keep session'));

    expect(screen.queryByText('Keep session')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Workout [AB]/)).toHaveLength(2);
  });

  it('undoing a delete restores the session', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getAllByText(/Workout [AB]/)[0].closest('button'));
    await user.click(screen.getByText('Delete Workout'));
    await user.click(screen.getByText('Delete anyway'));

    expect(screen.getAllByText(/Workout [AB]/)).toHaveLength(1);
    await user.click(screen.getByText('Undo'));

    expect(screen.getAllByText(/Workout [AB]/)).toHaveLength(2);
  });

  it('cancelling edit discards changes', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cards = screen.getAllByText(/Workout [AB]/);
    await user.click(cards[0].closest('button'));
    await user.click(screen.getByText('Edit workout'));

    const increaseButtons = screen.getAllByLabelText(/Increase .+ weight/);
    await user.click(increaseButtons[0]);

    await user.click(screen.getByLabelText('Close edit modal'));

    expect(screen.queryByLabelText('Edit workout')).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.history[0].exercises[0].weight).toBe(55);
  });
});

describe('Manual log entry', () => {
  const manualData = {
    version: 1,
    weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
    history: [
      { date: '2024-01-15T12:00:00.000Z', type: 'A', exercises: [
        { id: 'squat', name: 'Back Squat', weight: 60, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
        { id: 'bench', name: 'Bench Press', weight: 45, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
        { id: 'row', name: 'Barbell Row', weight: 50, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
      ]},
    ],
    nextType: 'B',
    isDark: true,
    autoSave: false,
    preferredRest: 90,
    soundEnabled: false,
    vibrationEnabled: false,
  };

  it('tapping + opens the modal with Add Workout title', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manualData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByLabelText('Add workout'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Add workout', { selector: 'h3' })).toBeInTheDocument();
    const toggleButtons = dialog.querySelectorAll('button');
    const toggleLabels = Array.from(toggleButtons).map(b => b.textContent);
    expect(toggleLabels).toContain('Workout A');
    expect(toggleLabels).toContain('Workout B');
    expect(screen.queryByText('Delete Workout')).not.toBeInTheDocument();
  });

  it('saving a manual entry adds it to history', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manualData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cardsBefore = screen.getAllByText(/Workout [AB]/).filter(el => el.closest('button[class*="rounded-[10px]"]'));
    expect(cardsBefore).toHaveLength(1);

    await user.click(screen.getByLabelText('Add workout'));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add workout' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const cardsAfter = screen.getAllByText(/Workout [AB]/).filter(el => el.closest('button[class*="rounded-[10px]"]'));
    expect(cardsAfter).toHaveLength(2);
  });
});

describe('Same-day workout prevention', () => {
  const todayISO = new Date().toISOString();
  const yesterdayISO = new Date(Date.now() - 86400000).toISOString();

  const dataWithToday = {
    version: 1,
    weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
    history: [
      { date: todayISO, type: 'A', exercises: [
        { id: 'squat', name: 'Back Squat', weight: 60, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
        { id: 'bench', name: 'Bench Press', weight: 45, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
        { id: 'row', name: 'Barbell Row', weight: 50, sets: 5, reps: 5, increment: 2.5, setsCompleted: [5,5,5,5,5] },
      ]},
    ],
    nextType: 'B',
    isDark: true,
    autoSave: false,
    preferredRest: 90,
    soundEnabled: false,
    vibrationEnabled: false,
  };

  const dataWithYesterday = {
    ...dataWithToday,
    history: [
      { ...dataWithToday.history[0], date: yesterdayISO },
    ],
  };

  it('disables Start Workout when a workout exists for today', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataWithToday));
    render(<App />);

    const btn = screen.getByText('Trained today').closest('button');
    expect(btn).toBeDisabled();
    expect(screen.getByText('Already trained today. Rest until next session.')).toBeInTheDocument();
  });

  it('enables Start Workout when no workout exists for today', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataWithYesterday));
    render(<App />);

    const btn = screen.getByText('Start workout').closest('button');
    expect(btn).not.toBeDisabled();
    expect(screen.queryByText('Already trained today. Rest until next session.')).not.toBeInTheDocument();
  });

  it('shows date conflict warning when edit date collides with existing session', async () => {
    const twoEntries = {
      ...dataWithToday,
      history: [
        { ...dataWithToday.history[0], date: todayISO },
        { ...dataWithToday.history[0], date: yesterdayISO, type: 'B' },
      ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(twoEntries));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cards = screen.getAllByText(/Workout [AB]/).map(el => el.closest('button[class*="rounded-[10px]"]')).filter(Boolean);
    await user.click(cards[1]);
    await user.click(screen.getByText('Edit workout'));

    const dialog = screen.getByRole('dialog');
    const dateInput = dialog.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: todayISO.slice(0, 10) } });

    expect(screen.getByText('A workout already exists on this date')).toBeInTheDocument();
    const saveBtn = screen.getByText('Save Changes').closest('button');
    expect(saveBtn).toBeDisabled();
  });

  it('shows future date warning and disables save when date is in the future', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataWithYesterday));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cards = screen.getAllByText(/Workout [AB]/).map(el => el.closest('button[class*="rounded-[10px]"]')).filter(Boolean);
    await user.click(cards[0]);
    await user.click(screen.getByText('Edit workout'));

    const dialog = screen.getByRole('dialog');
    const dateInput = dialog.querySelector('input[type="date"]');
    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10);
    fireEvent.change(dateInput, { target: { value: futureDate } });

    expect(screen.getByText('Date cannot be in the future')).toBeInTheDocument();
    const saveBtn = screen.getByText('Save Changes').closest('button');
    expect(saveBtn).toBeDisabled();
  });

  it('editing an entry and keeping its original date does not trigger conflict', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataWithToday));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    const cards = screen.getAllByText(/Workout [AB]/).map(el => el.closest('button[class*="rounded-[10px]"]')).filter(Boolean);
    await user.click(cards[0]);
    await user.click(screen.getByText('Edit workout'));

    expect(screen.queryByText('A workout already exists on this date')).not.toBeInTheDocument();
    const saveBtn = screen.getByText('Save Changes').closest('button');
    expect(saveBtn).not.toBeDisabled();
  });
});
