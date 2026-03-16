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
    expect(screen.getByLabelText('Hub')).toBeInTheDocument();
    expect(screen.getByLabelText('Stats')).toBeInTheDocument();
    expect(screen.getByLabelText('Options')).toBeInTheDocument();
  });

  it('collapses nav when returning to workout tab from another tab', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByLabelText('Show navigation'));
    await user.click(screen.getByLabelText('Hub'));

    expect(screen.getByText('Strength Hub')).toBeInTheDocument();
    expect(screen.getByLabelText('Train')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Train'));

    expect(screen.getByLabelText('Show navigation')).toBeInTheDocument();
    expect(screen.queryByLabelText('Hub')).not.toBeInTheDocument();
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
    expect(screen.getByLabelText('Hub')).toBeInTheDocument();
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
    await user.click(screen.getByLabelText('Hub'));

    expect(screen.getByText('Live Session')).toBeInTheDocument();
    expect(screen.getByText('Return')).toBeInTheDocument();
  });

  it('returns to workout tab when Live Session bar is clicked', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Start Session'));
    await user.click(screen.getByLabelText('Show navigation'));
    await user.click(screen.getByLabelText('Hub'));

    await user.click(screen.getByText('Return'));

    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.queryByText('Strength Hub')).not.toBeInTheDocument();
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
