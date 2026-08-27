import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { STORAGE_KEY } from '../../constants';
import { START_BUTTON, startWorkout } from '../helpers/train';

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

  it('steps the rest interval value directly, with no sheet or mode switch', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    // Opens on the committed 90s default, mm:ss like the presets. Matches both the
    // live value span and the now-lit 1:30 preset button, so scope to the span.
    expect(screen.getByText('1:30', { selector: 'span' })).toBeInTheDocument();

    await user.click(screen.getByLabelText('Increase rest interval'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(100);
    expect(screen.getByText('1:40')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Decrease rest interval'));
    await user.click(screen.getByLabelText('Decrease rest interval'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(80);
    expect(screen.getByText('1:20')).toBeInTheDocument();
  });

  it('clamps the rest interval at its floor and ceiling, dimming the stepper pressed against it', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const decrease = screen.getByLabelText('Decrease rest interval');
    const increase = screen.getByLabelText('Increase rest interval');
    expect(decrease.className).not.toMatch(/opacity-35/);

    for (let i = 0; i < 15; i++) await user.click(decrease); // 90s of -10s steps, well past the 0:30 floor
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(30);
    expect(decrease.className).toMatch(/opacity-35/);
    expect(increase.className).not.toMatch(/opacity-35/);

    for (let i = 0; i < 35; i++) await user.click(increase); // well past the 300s ceiling
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(300);
    expect(increase.className).toMatch(/opacity-35/);
    expect(decrease.className).not.toMatch(/opacity-35/);
  });

  it('clamps a stored preferredRest below the current floor up to it on load', () => {
    // CUSTOM_REST_MIN has moved (it used to track REST_WARNING_SECONDS at 5s, now a
    // flat 30s floor), so a value saved under the old floor needs to come back in range
    // rather than being trusted verbatim.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, preferredRest: 5, autoSave: false }));
    render(<App />);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(30);
  });

  it('drags the rest interval track to a snapped value', async () => {
    render(<App />);
    await userEvent.setup().click(screen.getByText('Options'));

    const track = screen.getByRole('slider', { name: 'Rest interval' });
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200, top: 0, height: 44, right: 200, bottom: 44 });
    track.setPointerCapture = vi.fn();
    track.releasePointerCapture = vi.fn();

    // Midpoint of a 200px-wide 0:30-5:00 track lands on (30+270*0.5)=165, snapped to
    // the nearest 10s -> 170.
    fireEvent.pointerDown(track, { clientX: 100, pointerId: 1 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(170);

    fireEvent.pointerMove(track, { clientX: 200, pointerId: 1 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(300);

    fireEvent.pointerUp(track, { clientX: 200, pointerId: 1 });
  });

  it('clamps a drag past either edge of the track, raising the matching notice', async () => {
    render(<App />);
    await userEvent.setup().click(screen.getByText('Options'));

    const track = screen.getByRole('slider', { name: 'Rest interval' });
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200, top: 0, height: 44, right: 200, bottom: 44 });
    track.setPointerCapture = vi.fn();
    track.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(track, { clientX: -50, pointerId: 1 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(30);
    expect(screen.getByText(/not enough to recover/)).toBeInTheDocument();
    fireEvent.pointerUp(track, { clientX: -50, pointerId: 1 });

    fireEvent.pointerDown(track, { clientX: 500, pointerId: 2 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(300);
    expect(screen.getByText(/too heavy/)).toBeInTheDocument();
    fireEvent.pointerUp(track, { clientX: 500, pointerId: 2 });
  });

  it('moves the rest interval by one step per arrow key, and jumps to the bounds with Home/End', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Options'));

    const track = screen.getByRole('slider', { name: 'Rest interval' });
    track.focus();

    await user.keyboard('{ArrowRight}');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(100);
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(80);
    await user.keyboard('{Home}');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(30);
    await user.keyboard('{End}');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(300);
  });

  it('exposes the rest interval slider bounds and live value to assistive tech', async () => {
    render(<App />);
    await userEvent.setup().click(screen.getByText('Options'));

    const track = screen.getByRole('slider', { name: 'Rest interval' });
    expect(track).toHaveAttribute('aria-valuemin', '30');
    expect(track).toHaveAttribute('aria-valuemax', '300');
    expect(track).toHaveAttribute('aria-valuenow', '90');
    expect(track).toHaveAttribute('aria-valuetext', '1:30');
  });

  it('lights up a preset only when the value happens to match it', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const preset180 = screen.getByRole('button', { name: '3:00' });
    expect(preset180.className).not.toMatch(/border-accent/);

    await user.click(preset180);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(180);
    expect(preset180.className).toMatch(/border-accent/);

    // Stepping away from the preset's exact value drops the lit state again.
    await user.click(screen.getByLabelText('Increase rest interval'));
    expect(preset180.className).not.toMatch(/border-accent/);
  });

  it('only shows the 5:00 ceiling explainer once the user presses against it', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const explainer = 'Greater than 5 minutes suggests the weight is too heavy. Deload to continue instead.';
    expect(screen.queryByText(explainer)).not.toBeInTheDocument();

    // Jumping straight to the 5:00 preset doesn't count as pressing against the cap.
    await user.click(screen.getByRole('button', { name: '5:00' }));
    expect(screen.queryByText(explainer)).not.toBeInTheDocument();

    // Pressing + while already at the ceiling is what surfaces the explanation.
    await user.click(screen.getByLabelText('Increase rest interval'));
    expect(screen.getByText(explainer)).toBeInTheDocument();

    // Any other interaction clears it again.
    await user.click(screen.getByLabelText('Decrease rest interval'));
    expect(screen.queryByText(explainer)).not.toBeInTheDocument();
  });

  it('warns when the value drops under a minute, and clears the warning again on any other change', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const warning = 'Less than 1 minute rest between sets is not enough to recover.';
    const decrease = screen.getByLabelText('Decrease rest interval');
    expect(screen.queryByText(warning)).not.toBeInTheDocument();

    // 90s -> 80 -> 70 -> 60 -> 50: only the last step lands under the 60s floor.
    await user.click(decrease);
    await user.click(decrease);
    await user.click(decrease);
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    await user.click(decrease);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBe(50);
    expect(screen.getByText(warning)).toBeInTheDocument();

    // Jumping to a preset clears it, same as the cap explainer.
    await user.click(screen.getByRole('button', { name: '3:00' }));
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });

  it('shows the matching set-intensity band for the live value, independent of the notices', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    // Default 90s is already inside the Light Set band.
    expect(screen.getByText('Light Set')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '3:00' }));
    expect(screen.getByText('Medium Set')).toBeInTheDocument();
    expect(screen.queryByText('Light Set')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '5:00' }));
    expect(screen.getByText('Heavy Set')).toBeInTheDocument();

    // Below the 60s floor there's no band to name -- the short-rest notice takes over.
    const decrease = screen.getByLabelText('Decrease rest interval');
    for (let i = 0; i < 30; i++) await user.click(decrease);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).preferredRest).toBeLessThan(60);
    expect(screen.queryByText('Heavy Set')).not.toBeInTheDocument();
    expect(screen.queryByText(/Typical for:/)).not.toBeInTheDocument();
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

  it('toggles the five-second warning setting, defaulted on, once sound is on', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));
    await user.click(screen.getByRole('switch', { name: 'Sound alert' }));

    const warningSwitch = screen.getByRole('switch', { name: 'Five-second warning' });
    expect(warningSwitch.getAttribute('aria-checked')).toBe('true');
    await user.click(warningSwitch);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.restWarningEnabled).toBe(false);
  });

  // The warning has no way to reach the user except the chime, so with Sound alert off
  // it must not sit there reading as on while doing nothing.
  it('disables the five-second warning row while Sound alert is off, and explains why', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const warningSwitch = screen.getByRole('switch', { name: 'Five-second warning' });
    expect(warningSwitch).toBeDisabled();
    expect(screen.getByText('Needs Sound alert on')).toBeInTheDocument();
    expect(screen.queryByText('Sound countdown from 5 seconds')).not.toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: 'Sound alert' }));

    expect(screen.getByRole('switch', { name: 'Five-second warning' })).toBeEnabled();
    expect(screen.getByText('Sound countdown from 5 seconds')).toBeInTheDocument();
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

  it('switches theme via the Dark/Light segmented control', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Options'));
    await user.click(screen.getByText('Light'));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.isDark).toBe(false);
  });

  it('navigates between tabs', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('Log'));
    expect(screen.getByRole('heading', { name: 'Log' })).toBeInTheDocument();

    await user.click(screen.getByLabelText('Stats'));
    expect(screen.getByText('No Stats Yet')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Options'));
    expect(screen.getByText('Rest interval')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Train'));
    expect(screen.getByText(START_BUTTON)).toBeInTheDocument();
  });

  describe('changing the interval while a rest is running', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const firstSetButton = () => screen.getAllByRole('button')
      .filter((b) => b.getAttribute('aria-label')?.startsWith('Set '))[0];

    // The marker's own caret label (10px, tabular-nums) is distinct from the muted 9px
    // preset-reference labels the track also shows now -- those can legitimately read
    // "1:30" or "3:00" too, for an unrelated reference point, so asserting on the
    // marker specifically (rather than "this text appears nowhere on the page") is what
    // actually proves whether a retarget happened.
    const markerLabel = (container) => container.querySelector('.text-\\[10px\\]');

    it('retargets the running rest marker instead of waiting for the next set', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
        history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
        nextType: 'A', isDark: true, autoSave: false, preferredRest: 90,
      }));
      const { container } = render(<App />);

      await startWorkout(user);
      await user.click(firstSetButton()); // starts rest at the default 1:30

      await user.click(screen.getByText('Options'));
      await user.click(screen.getByText('3:00'));

      await user.click(screen.getByText('Train'));
      // The strip's marker reflects the new interval for the rest already running,
      // not just the next one.
      expect(markerLabel(container)).toHaveTextContent('3:00');
    });

    it('does not retarget a Madcow ramp rest, which is not driven by the interval setting', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
        history: [{ date: new Date(Date.now() - 86400000).toISOString(), type: 'A', exercises: [] }],
        nextType: 'A', isDark: true, autoSave: false, preferredRest: 90,
        soundEnabled: false, vibrationEnabled: false,
        preset: 'madcow',
        mcTop: { squat: 60, bench: 45, row: 50, deadlift: 80, press: 32.5, incline: 40 },
        mcWeek: 5, mcInterval: 12.5, mcPress: 'incline', mcNextDay: 'A',
      }));
      const { container } = render(<App />);

      await startWorkout(user);
      // Day A's squat ramps rest across its five sets as [90, 180, 180, 300] -- log
      // the first four to land on the 300s rest into the top-effort set, a value
      // distinct from both the app's default (90) and what this test switches to
      // (180), so a wrongly-firing retarget would actually be caught.
      const setButtons = () => screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label')?.startsWith('Set '));
      await user.click(setButtons()[0]);
      await user.click(setButtons()[1]);
      await user.click(setButtons()[2]);
      await user.click(setButtons()[3]);

      await user.click(screen.getByText('Options'));
      await user.click(screen.getByText('3:00'));

      await user.click(screen.getByText('Train'));
      expect(markerLabel(container)).toHaveTextContent('5:00');
    });
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

    await startWorkout(user);
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

    await startWorkout(user);
    await user.click(screen.getByText('Skip Deload'));

    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
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

    await startWorkout(user);
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

    await startWorkout(user);
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

    await startWorkout(user);
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

    await startWorkout(user);
    await user.click(screen.getByText('Accept & Lift'));

    await user.click(screen.getByText('Discard workout'));
    await user.click(screen.getByText('Yes, discard'));

    await startWorkout(user);
    expect(screen.queryByText('Deload Recommended')).not.toBeInTheDocument();
    expect(screen.getByText('Finish workout')).toBeInTheDocument();
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
    const addDialog = screen.getByRole('dialog');
    await user.click(within(addDialog).getByRole('button', { name: 'Add workout' }));

    expect(screen.queryByText('Deload Needed')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Train'));
    await startWorkout(user);
    expect(screen.getByText('Deload Needed')).toBeInTheDocument();
  });
});

describe('Help modal', () => {
  it('opens when the header help button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('How it works'));
    expect(screen.getByRole('dialog', { name: 'How it works' })).toBeInTheDocument();
    expect(screen.getByText('How it works')).toBeInTheDocument();
  });

  it('closes when "Got It" button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('How it works'));
    expect(screen.getByRole('dialog', { name: 'How it works' })).toBeInTheDocument();

    await user.click(screen.getByText('Got it'));
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

  it('no longer covers Program/Progression/Stall/Deload, and links to the Program tab instead', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText('How it works'));
    const dialog = screen.getByRole('dialog', { name: 'How it works' });
    expect(within(dialog).queryByText('Progression')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Deload')).not.toBeInTheDocument();

    await user.click(within(dialog).getByText('Sets, reps and progression'));
    expect(screen.queryByRole('dialog', { name: 'How it works' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Program' })).toBeInTheDocument();
    expect(screen.getByText('Standard 5×5')).toBeInTheDocument();
  });
});
