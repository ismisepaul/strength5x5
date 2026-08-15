import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrainScreen from '../../screens/TrainScreen';
import { getMonStart } from '../../utils/chartData';

// A date within the current Mon-Sun week (regardless of which weekday the suite
// actually runs on), so getWeekVerdict/getWorkoutStats bucket it alongside `now`.
const dayInThisWeek = (offset) => {
  const d = getMonStart(new Date());
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

const baseProps = {
  isWorkoutActive: false, preset: 'standard', getCurrentDay: () => 'A',
  program: {}, weights: { squat: 50, bench: 40, row: 45, press: 30, deadlift: 60 },
  mcTop: {}, mcInterval: 12.5, mcPress: 'press', mcWeek: 1, moodLabel: () => null,
  expandedBarSetup: {}, setExpandedBarSetup: vi.fn(), setWorkoutPicker: vi.fn(),
  updateMcTop: vi.fn(), handleUpdateIdleWeight: vi.fn(), setGuideLift: vi.fn(),
  startWorkout: vi.fn(), trainedToday: false, history: [], onGoToLog: vi.fn(),
  currentWorkout: null, handleToggleSet: vi.fn(), handleOpenRepPicker: vi.fn(),
  handleUpdateActiveWeight: vi.fn(), handleUpdateActiveSetWeight: vi.fn(),
  finishWorkout: vi.fn(), setShowCancelModal: vi.fn(),
};

describe('TrainScreen week verdict line', () => {
  it('shows a plain invitation with no history, and routes to Log on tap', async () => {
    const user = userEvent.setup();
    const onGoToLog = vi.fn();
    render(<TrainScreen {...baseProps} onGoToLog={onGoToLog} />);

    const verdict = screen.getByText('Train day');
    expect(verdict).toBeInTheDocument();
    await user.click(verdict.closest('button'));
    expect(onGoToLog).toHaveBeenCalled();
  });

  it('shows "Start workout" (not "Start anyway") when the week is untouched', () => {
    render(<TrainScreen {...baseProps} />);
    expect(screen.getByText('Start workout')).toBeInTheDocument();
    expect(screen.queryByText('Start anyway')).not.toBeInTheDocument();
  });

  it('disables the button entirely once today is already logged -- one session a day', () => {
    const history = [{ date: new Date().toISOString() }];
    render(<TrainScreen {...baseProps} trainedToday history={history} />);
    const btn = screen.getByText('Trained today').closest('button');
    expect(btn).toBeDisabled();
    expect(screen.getByText('Already trained today. Rest until next session.')).toBeInTheDocument();
    expect(screen.queryByText('Start anyway')).not.toBeInTheDocument();
  });

  it('keeps the button disabled on a complete week when today is also already logged', () => {
    const history = [dayInThisWeek(0), dayInThisWeek(1), new Date().toISOString()].map(date => ({ date }));
    render(<TrainScreen {...baseProps} trainedToday history={history} />);
    expect(screen.getByText('Trained today').closest('button')).toBeDisabled();
  });

  it('offers "Start anyway" on a rest day -- trained yesterday, nothing logged today', () => {
    render(<TrainScreen {...baseProps} history={[{ date: yesterday() }]} />);
    expect(screen.getByText('Rest day · you trained yesterday')).toBeInTheDocument();
    const btn = screen.getByText('Start anyway').closest('button');
    expect(btn).not.toBeDisabled();
    expect(screen.queryByText('Start workout')).not.toBeInTheDocument();
  });

  it('offers "Start anyway" once the week\'s 3-session goal is met, even without training today', () => {
    const history = [dayInThisWeek(0), dayInThisWeek(1), dayInThisWeek(2)].map(date => ({ date }));
    render(<TrainScreen {...baseProps} history={history} />);
    expect(screen.getByText('Week complete')).toBeInTheDocument();
    const btn = screen.getByText('Start anyway').closest('button');
    expect(btn).not.toBeDisabled();
  });
});

describe('TrainScreen extra-session confirmation', () => {
  const confirmDialog = () => screen.getByRole('dialog', { name: 'Train anyway?' });

  it('starts immediately on a train day, with no confirmation in the way', async () => {
    const user = userEvent.setup();
    const startWorkout = vi.fn();
    render(<TrainScreen {...baseProps} startWorkout={startWorkout} />);

    await user.click(screen.getByText('Start workout'));
    expect(startWorkout).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks first on a rest day, and gives the rest-day reason', async () => {
    const user = userEvent.setup();
    const startWorkout = vi.fn();
    render(<TrainScreen {...baseProps} history={[{ date: yesterday() }]} startWorkout={startWorkout} />);

    await user.click(screen.getByText('Start anyway'));
    expect(startWorkout).not.toHaveBeenCalled();
    expect(within(confirmDialog()).getByText(/You trained yesterday/)).toBeInTheDocument();
  });

  it('gives the week-complete reason instead when the week is already banked', async () => {
    const user = userEvent.setup();
    const history = [dayInThisWeek(0), dayInThisWeek(1), dayInThisWeek(2)].map(date => ({ date }));
    render(<TrainScreen {...baseProps} history={history} />);

    await user.click(screen.getByText('Start anyway'));
    expect(within(confirmDialog()).getByText(/already banked three sessions/)).toBeInTheDocument();
  });

  it('backs out without starting when the lifter takes the rest', async () => {
    const user = userEvent.setup();
    const startWorkout = vi.fn();
    render(<TrainScreen {...baseProps} history={[{ date: yesterday() }]} startWorkout={startWorkout} />);

    await user.click(screen.getByText('Start anyway'));
    await user.click(within(confirmDialog()).getByText('Rest instead'));

    expect(startWorkout).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts the session once confirmed', async () => {
    const user = userEvent.setup();
    const startWorkout = vi.fn();
    render(<TrainScreen {...baseProps} history={[{ date: yesterday() }]} startWorkout={startWorkout} />);

    await user.click(screen.getByText('Start anyway'));
    await user.click(within(confirmDialog()).getByText('Start anyway'));

    expect(startWorkout).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
