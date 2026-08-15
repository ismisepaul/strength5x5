import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The chime is the only way to observe the warning's audio, and jsdom has no
// AudioContext (createChime would swallow its own failure), so the module is mocked
// and the spies are asserted on directly.
const pip = vi.fn();
const play = vi.fn();
vi.mock('../../audio/chime', () => ({
  createChime: () => ({ pip, play, unlock: vi.fn() }),
}));

import App from '../../App';
import { STORAGE_KEY, REST_WARNING_SECONDS } from '../../constants';
import { startWorkout } from '../helpers/train';

// 8s of rest: long enough that the run-up is ordinary rest and the warning window is
// entered partway through, rather than the whole timer being one long warning.
const REST = 8;

const fixture = (over = {}) => JSON.stringify({
  version: 1,
  weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
  history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
  nextType: 'A', isDark: true, autoSave: false,
  preferredRest: REST, soundEnabled: true, vibrationEnabled: false, restWarningEnabled: true,
  ...over,
});

const firstSetButton = () => screen.getAllByRole('button')
  .filter(b => b.getAttribute('aria-label')?.startsWith('Set '))[0];

// useTimer polls on a 250ms interval. Advancing one tick at a time is what makes each
// distinct `seconds` value actually commit -- advancing the whole rest in one jump lets
// React coalesce the updates and skip intermediate seconds, which is a fake-timer
// artifact rather than anything the real 250ms-apart ticks do.
const tick = async (times) => {
  for (let i = 0; i < times; i++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  }
};

const startRest = async (user) => {
  await startWorkout(user);
  await user.click(firstSetButton());
};

describe('rest timer five-second warning', () => {
  beforeEach(() => {
    localStorage.clear();
    pip.mockClear();
    play.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => { vi.useRealTimers(); });

  const setup = async (over) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(STORAGE_KEY, fixture(over));
    render(<App />);
    return user;
  };

  it('plays one rising pip per second of the final five, then the expiry chime', async () => {
    const user = await setup();
    await startRest(user);

    await tick(4 * REST + 4);

    expect(pip.mock.calls.flat()).toEqual([0, 1, 2, 3, 4]);
    expect(pip).toHaveBeenCalledTimes(REST_WARNING_SECONDS);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('plays no pips before the warning window opens', async () => {
    const user = await setup();
    await startRest(user);

    // 8s -> 6s remaining, still two seconds clear of the window.
    await tick(8);
    expect(pip).not.toHaveBeenCalled();
    expect(screen.getByText('Rest')).toBeInTheDocument();
  });

  it('plays no pips when sound is off, and still none when only the warning is off', async () => {
    const user = await setup({ soundEnabled: false });
    await startRest(user);
    await tick(4 * REST + 4);
    expect(pip).not.toHaveBeenCalled();

    pip.mockClear();
    localStorage.clear();
    const user2 = await setup({ restWarningEnabled: false });
    await startRest(user2);
    await tick(4 * REST + 4);
    expect(pip).not.toHaveBeenCalled();
  });

  it('does not replay the current second when a sound setting is toggled mid-window', async () => {
    const user = await setup();
    await startRest(user);

    // Into the window, with the countdown showing 4.
    await tick(17);
    const during = pip.mock.calls.length;
    expect(during).toBeGreaterThan(0);

    // The rest timer keeps running while the user is on Options, so toggling a switch
    // there re-runs the pip effect against an unchanged `seconds`. It must not pip.
    await user.click(screen.getByText('Options'));
    const warningSwitch = screen.getByRole('switch', { name: 'Five-second warning' });
    await user.click(warningSwitch);
    await user.click(warningSwitch);

    expect(pip).toHaveBeenCalledTimes(during);
  });

  it('skipping rest during the warning window stops the pips', async () => {
    const user = await setup();
    await startRest(user);

    await tick(13); // 5s remaining, first pip fired
    expect(pip).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText('Skip rest'));
    await tick(20);

    expect(pip).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();
  });
});
