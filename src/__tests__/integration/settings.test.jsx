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

describe('Settings', () => {
  it('changes rest timer preference and persists to localStorage', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));
    await user.click(screen.getByText('3:00'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.preferredRest).toBe(180);
  });

  it('toggles sound setting', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const soundSwitch = screen.getByRole('switch', { name: 'Sound alert' });
    expect(soundSwitch.getAttribute('aria-checked')).toBe('false');
    await user.click(soundSwitch);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.soundEnabled).toBe(true);
  });

  it('toggles vibration setting', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const vibSwitch = screen.getByRole('switch', { name: 'Vibration' });
    expect(vibSwitch.getAttribute('aria-checked')).toBe('false');
    await user.click(vibSwitch);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.vibrationEnabled).toBe(true);
  });

  it('toggles local backup setting', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const localSwitch = screen.getByRole('switch', { name: 'Local backup' });
    expect(localSwitch.getAttribute('aria-checked')).toBe('false');
    await user.click(localSwitch);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.autoSave).toBe(true);
  });

  it('toggles dark mode', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Options'));
    const toggle = screen.getByLabelText('Dark mode');
    await user.click(toggle);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.isDark).toBe(false);
  });

  it('navigates between tabs', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    expect(screen.getByText('Workout Log')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Stats'));
    expect(screen.getByText('No Stats Yet')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Options'));
    expect(screen.getByText('Rest Interval')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Train'));
    expect(screen.getByText('Start Workout')).toBeInTheDocument();
  });
});

describe('Deload', () => {
  it('shows deload prompt with slider after 14+ days gap', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 15);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [{ date: oldDate.toISOString(), type: 'A', exercises: [] }],
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
    expect(screen.getByText('Deload Recommended')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByText('Accept & Lift')).toBeInTheDocument();
    expect(screen.getByText('Skip Deload')).toBeInTheDocument();
  });

  it('can skip deload and start with current weights', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 15);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [{ date: oldDate.toISOString(), type: 'A', exercises: [] }],
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
    await user.click(screen.getByText('Skip Deload'));

    expect(screen.getByText('60kg')).toBeInTheDocument();
  });

  it('can accept deload with default percentage', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 15);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 100, bench: 80, row: 70, press: 50, deadlift: 120 },
      history: [{ date: oldDate.toISOString(), type: 'A', exercises: [] }],
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
    await user.click(screen.getByText('Accept & Lift'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(90);
  });

  it('shows higher recommended percentage for longer breaks', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 45);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 100, bench: 80, row: 70, press: 50, deadlift: 120 },
      history: [{ date: oldDate.toISOString(), type: 'A', exercises: [] }],
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
    expect(screen.getByText('Recommended: 50%')).toBeInTheDocument();
  });

  it('shows exercise weight previews in deload modal', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 15);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 100, bench: 80, row: 70, press: 50, deadlift: 120 },
      history: [{ date: oldDate.toISOString(), type: 'A', exercises: [] }],
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
    const dialog = screen.getByRole('dialog', { name: 'Deload recommendation' });
    expect(within(dialog).getByText(/100kg/)).toBeInTheDocument();
    expect(within(dialog).getByText(/90kg/)).toBeInTheDocument();
  });

  it('does not prompt long-break deload again after accepting then discarding workout', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 15);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 100, bench: 80, row: 70, press: 50, deadlift: 120 },
      history: [{ date: oldDate.toISOString(), type: 'A', exercises: [] }],
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
    await user.click(screen.getByText('Accept & Lift'));

    await user.click(screen.getByText('Discard Workout'));
    await user.click(screen.getByText('Yes, Discard Everything'));

    await user.click(screen.getByText('Start Workout'));
    expect(screen.queryByText('Deload Recommended')).not.toBeInTheDocument();
    expect(screen.getByText('Finish Workout')).toBeInTheDocument();
  });

  it('requests deload when latest manually logged workout creates 3-failure streak', async () => {
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

    await user.click(screen.getByLabelText('Log'));
    await user.click(screen.getByLabelText('Add workout'));

    const setButtons = screen.getAllByRole('button').filter(btn => {
      const label = btn.getAttribute('aria-label');
      return label && label.startsWith('Set ');
    });

    await user.click(setButtons[0]);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const dateInput = screen.getByDisplayValue(new Date().toISOString().slice(0, 10));
    fireEvent.change(dateInput, { target: { value: yesterday } });
    await user.click(screen.getByRole('button', { name: 'Add Workout' }));

    expect(screen.queryByText('Deload Needed')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Train'));
    await user.click(screen.getByText('Start Workout'));
    expect(screen.getByText('Deload Needed')).toBeInTheDocument();
  });
});

describe('Help modal', () => {
  it('opens when the header help button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('How it works'));
    expect(screen.getByRole('dialog', { name: 'How it works' })).toBeInTheDocument();
    expect(screen.getByText('How It Works')).toBeInTheDocument();
  });

  it('closes when "Got It" button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('How it works'));
    expect(screen.getByRole('dialog', { name: 'How it works' })).toBeInTheDocument();

    await user.click(screen.getByText('Got It'));
    expect(screen.queryByRole('dialog', { name: 'How it works' })).not.toBeInTheDocument();
  });

  it('closes when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('How it works'));
    const dialog = screen.getByRole('dialog', { name: 'How it works' });
    expect(dialog).toBeInTheDocument();

    await user.click(dialog);
    expect(screen.queryByRole('dialog', { name: 'How it works' })).not.toBeInTheDocument();
  });
});
