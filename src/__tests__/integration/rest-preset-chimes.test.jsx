import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Same rationale as rest-warning.test.jsx: jsdom has no AudioContext, so the chime
// module is mocked and the spy is asserted on directly.
const pip = vi.fn();
const play = vi.fn();
const unlock = vi.fn();
vi.mock('../../audio/chime', () => ({
  createChime: () => ({ pip, play, unlock }),
}));

import App from '../../App';
import { STORAGE_KEY } from '../../constants';
import { startWorkout } from '../helpers/train';

const fixture = (over = {}) => JSON.stringify({
  version: 1,
  weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
  history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
  nextType: 'A', isDark: true, autoSave: false,
  soundEnabled: true, vibrationEnabled: false, restWarningEnabled: false,
  ...over,
});

const firstSetButton = () => screen.getAllByRole('button')
  .filter(b => b.getAttribute('aria-label')?.startsWith('Set '))[0];

const startRest = async (user) => {
  await startWorkout(user);
  await user.click(firstSetButton());
};

// A single large advance is enough here (unlike the per-second pip test): this only
// asserts a final chime *count*, not which exact tick each one landed on.
const jump = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('rest preset chimes', () => {
  beforeEach(() => {
    localStorage.clear();
    pip.mockClear();
    play.mockClear();
    unlock.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => { vi.useRealTimers(); });

  const setup = async (over) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(STORAGE_KEY, fixture(over));
    render(<App />);
    return user;
  };

  it('chimes at 3:00 and 5:00 in addition to the marker, for a 1:30 rest that runs long', async () => {
    const user = await setup({ preferredRest: 90 });
    await startRest(user);

    await jump(90 * 1000 + 250); // past the 1:30 marker
    expect(play).toHaveBeenCalledTimes(1);

    await jump(90 * 1000); // raw elapsed ~185s, past the 3:00 preset
    expect(play).toHaveBeenCalledTimes(2);

    await jump(120 * 1000); // raw elapsed ~305s, past the 5:00 preset
    expect(play).toHaveBeenCalledTimes(3);

    await jump(60 * 1000); // no preset left above 5:00 -- no further chimes
    expect(play).toHaveBeenCalledTimes(3);
  });

  it('does not chime twice for a marker that already sits on a preset', async () => {
    const user = await setup({ preferredRest: 180 });
    await startRest(user);

    await jump(180 * 1000 + 250); // marker itself is the 3:00 preset -- one chime, not two
    expect(play).toHaveBeenCalledTimes(1);

    await jump(120 * 1000); // raw elapsed ~305s, past the 5:00 preset
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('plays no preset chimes when sound is off', async () => {
    const user = await setup({ preferredRest: 90, soundEnabled: false });
    await startRest(user);

    await jump(310 * 1000); // well past every preset
    expect(play).not.toHaveBeenCalled();
  });

  // The rest keeps running while you're on the Options tab, so both of these are things
  // that can happen to a rest already well into overtime. Neither is the lifter counting
  // through a checkpoint, so neither should sound one.
  it('does not replay presets already passed when sound is switched on mid-rest', async () => {
    const user = await setup({ preferredRest: 90, soundEnabled: false });
    await startRest(user);

    // Split at the marker: the overtime ticker is a newly-mounted effect as of that
    // transition, so it only starts counting once this act has flushed.
    await jump(90 * 1000 + 250);
    await jump(110 * 1000); // ~3:20 elapsed, so the 3:00 preset goes by while muted

    await user.click(screen.getByLabelText('Options'));
    await user.click(screen.getByRole('switch', { name: 'Sound alert' }));
    await jump(2000);
    expect(play).not.toHaveBeenCalled();

    // The 5:00 preset is still ahead, so it does sound when the rest actually reaches it.
    await jump(110 * 1000);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('does not chime for presets the marker is dragged back past', async () => {
    const user = await setup({ preferredRest: 300 });
    await startRest(user);

    await jump(240 * 1000); // 4:00 into a 5:00 rest, still counting down -- silent so far
    expect(play).not.toHaveBeenCalled();

    // Retargeting to 1:30 drops the marker below 4:00 elapsed, putting the 3:00 preset
    // behind it in one move. That is the marker moving, not time passing.
    await user.click(screen.getByLabelText('Options'));
    await user.click(screen.getByText('1:30'));
    await jump(2000);
    expect(play).not.toHaveBeenCalled();

    await jump(60 * 1000); // raw elapsed ~5:00 -- the one preset still ahead does sound
    expect(play).toHaveBeenCalledTimes(1);
  });
});
