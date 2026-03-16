import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('toggles auto-backup setting', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const autoSwitch = screen.getByRole('switch', { name: 'Auto-backup' });
    expect(autoSwitch.getAttribute('aria-checked')).toBe('true');
    await user.click(autoSwitch);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.autoSave).toBe(false);
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
    expect(screen.getByText('Start Session')).toBeInTheDocument();
  });
});

describe('Deload', () => {
  it('shows deload prompt after 14+ days gap', async () => {
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

    await user.click(screen.getByText('Start Session'));
    expect(screen.getByText('Accept Deload?')).toBeInTheDocument();
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

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByText('Skip Deload'));

    expect(screen.getByText('60kg')).toBeInTheDocument();
  });

  it('can accept deload with reduced weights', async () => {
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

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByText('Accept & Lift'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(90);
  });
});
