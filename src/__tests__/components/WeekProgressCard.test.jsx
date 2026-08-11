import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeekProgressCard from '../../components/WeekProgressCard';
import { getMonStart } from '../../utils/chartData';

const session = (date, exercises) => ({
  date: new Date(date).toISOString(),
  exercises: exercises.map(([id, weight, setsCompleted]) => ({
    id, name: id, weight, sets: setsCompleted.length, reps: 5, increment: 2.5, setsCompleted,
  })),
});

// The card has no `now` override -- it always reads the real clock via
// getWeekDayStates/getWorkoutStats -- so a day-strip test can't hardcode "Monday is
// trained, Tuesday is rest" (today itself might land on either of those and pick up the
// dashed "today" state instead of the plain one). This picks the trained day two slots
// after today (mod 7, Monday-indexed), which guarantees both it and the day right after
// it fall in the current week without ever landing on today, regardless of which weekday
// the suite actually runs on.
const weekdayIndex = (n) => {
  const d = getMonStart(new Date());
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
};

describe('WeekProgressCard', () => {
  it('renders the week card with no toggle -- everything is visible up front', () => {
    const { container } = render(<WeekProgressCard history={[]} remainingSessionLiftIds={[]} />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('projects a progressing lift forward across the remaining sessions', () => {
    const history = [session('2024-01-15', [['squat', 50, [5, 5, 5, 5, 5]]])];
    render(
      <WeekProgressCard
        history={history}
        remainingSessionLiftIds={[['squat'], ['squat']]}
        ramped={false}
        increments={{ squat: 2.5 }}
      />
    );
    // status 'first' (only one occurrence) -> current 50, projected +2.5 x 2 remaining sessions
    expect(screen.getByText('50 → 55 kg')).toBeInTheDocument();
  });

  it('caps the projection at one increment for a ramped (Madcow) program', () => {
    const history = [session('2024-01-15', [['squat', 50, [5, 5, 5, 5, 5]]])];
    render(
      <WeekProgressCard
        history={history}
        remainingSessionLiftIds={[['squat'], ['squat']]}
        ramped
        increments={{ squat: 2.5 }}
      />
    );
    expect(screen.getByText('50 → 52.5 kg')).toBeInTheDocument();
  });

  it('shows a plain current weight when no remaining session touches the lift', () => {
    const history = [session('2024-01-15', [['squat', 50, [5, 5, 5, 5, 5]]])];
    render(<WeekProgressCard history={history} remainingSessionLiftIds={[['bench']]} increments={{ squat: 2.5 }} />);
    expect(screen.getByText('50 kg')).toBeInTheDocument();
  });

  it('shows a miss chip and "holds" wording for a held lift, without projecting it forward', () => {
    const history = [
      session('2024-01-15', [['press', 30, [5, 5, 5, 3, null]]]),
      session('2024-01-08', [['press', 30, [5, 5, 5, 5, 5]]]),
    ];
    render(<WeekProgressCard history={history} remainingSessionLiftIds={[['press']]} increments={{ press: 2.5 }} />);
    expect(screen.getByText('1 miss')).toBeInTheDocument();
    expect(screen.getByText('Holds 30 kg')).toBeInTheDocument();
  });

  it('shows a deload chip and the actual from/to weights, without projecting a dropped lift forward', () => {
    const history = [
      session('2024-01-15', [['deadlift', 77.5, [5]]]),
      session('2024-01-08', [['deadlift', 85, [5]]]),
    ];
    render(<WeekProgressCard history={history} remainingSessionLiftIds={[['deadlift']]} increments={{ deadlift: 5 }} />);
    expect(screen.getByText('Deload')).toBeInTheDocument();
    expect(screen.getByText('85 → 77.5 kg')).toBeInTheDocument();
  });

  it('omits a lift from the breakdown when it has never been trained', () => {
    const history = [session('2024-01-15', [['squat', 50, [5, 5, 5, 5, 5]]])];
    render(<WeekProgressCard history={history} remainingSessionLiftIds={[]} />);
    expect(screen.queryByText('Deadlift')).not.toBeInTheDocument();
  });

  it('shows the day strip with a trained day, the day after as rest, and one still available', () => {
    const todayIdx = (new Date().getDay() + 6) % 7; // Monday-indexed
    const trainedIdx = (todayIdx + 2) % 7; // always >= 2 slots from today, and so is +1
    const trainedDay = weekdayIndex(trainedIdx);
    render(<WeekProgressCard history={[session(trainedDay.toISOString(), [['squat', 50, [5, 5, 5, 5, 5]]])]} remainingSessionLiftIds={[]} />);
    expect(screen.getAllByTitle('Trained')).toHaveLength(1);
    expect(screen.getAllByTitle('Rest · trained the day before')).toHaveLength(1);
  });

  it('gives the card an accent border and "Week complete" once the goal is met', () => {
    const history = [0, 1, 2].map(n => session(weekdayIndex(n).toISOString(), [['squat', 50, [5, 5, 5, 5, 5]]]));
    const { container } = render(<WeekProgressCard history={history} remainingSessionLiftIds={[]} />);
    expect(screen.getByText('Week complete')).toBeInTheDocument();
    expect(container.firstChild.className).toContain('border-accent');
  });

  it('shows how many sessions are left when the week is not yet complete', () => {
    render(<WeekProgressCard history={[session(weekdayIndex(0).toISOString(), [['squat', 50, [5, 5, 5, 5, 5]]])]} remainingSessionLiftIds={[]} />);
    expect(screen.getByText('2 to go')).toBeInTheDocument();
  });
});
