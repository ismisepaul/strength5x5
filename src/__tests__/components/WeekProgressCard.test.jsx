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
// dashed "today" state instead of the plain one, or push the successor day outside the
// displayed Mon-Sun strip). Picking Saturday when today is early in the week, or Monday
// otherwise, keeps both the trained day and its successor inside the strip and off
// today, for every possible weekday the suite might run on.
const weekdayIndex = (n) => {
  const d = getMonStart(new Date());
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
};
const todayIdx = (new Date().getDay() + 6) % 7; // Monday-indexed
const safeTrainedIdx = todayIdx <= 3 ? 5 : 0; // Sat if today is Mon-Thu, else Mon

describe('WeekProgressCard', () => {
  it('renders the week card with no toggle -- everything is visible up front', () => {
    const { container } = render(<WeekProgressCard history={[]} remainingSessionLiftIds={[]} />);
    expect(container.querySelector('button')).toBeNull();
  });

  // The baseline for every lift row is the *live* program weight (weights[id]), not the
  // last logged session -- see getWeekLiftProjection in chartData.js. Fixtures below set
  // weights one increment ahead of what's logged, matching the real app right after a
  // passing Standard session.

  it('projects a progressing lift forward from the live weight, across the remaining sessions', () => {
    const history = [session('2024-01-15', [['squat', 50, [5, 5, 5, 5, 5]]])];
    render(
      <WeekProgressCard
        history={history}
        liftIds={['squat']}
        weights={{ squat: 52.5 }}
        remainingSessionLiftIds={[['squat'], ['squat']]}
        increments={{ squat: 2.5 }}
      />
    );
    expect(screen.getByText('50 → 57.5 kg')).toBeInTheDocument();
  });

  it('shows a flat current top set for a ramped program, never a projection', () => {
    const history = [session('2024-01-15', [['squat', 85, [5, 5, 5, 5, 5]]])];
    render(
      <WeekProgressCard
        history={history}
        liftIds={['squat']}
        weights={{ squat: 90 }}
        remainingSessionLiftIds={[['squat'], ['squat']]}
        ramped
        increments={{ squat: 2.5 }}
      />
    );
    expect(screen.getByText('90 kg')).toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('shows the live current weight when no remaining session touches the lift', () => {
    const history = [session('2024-01-15', [['squat', 50, [5, 5, 5, 5, 5]]])];
    render(<WeekProgressCard history={history} liftIds={['squat']} weights={{ squat: 52.5 }} remainingSessionLiftIds={[['bench']]} increments={{ squat: 2.5 }} />);
    expect(screen.getByText('52.5 kg')).toBeInTheDocument();
  });

  it('shows a miss chip and "holds" wording for a held lift, from the latest session\'s own miss flag', () => {
    const history = [session('2024-01-15', [['press', 30, [5, 5, 5, 3, null]]])];
    render(<WeekProgressCard history={history} liftIds={['press']} weights={{ press: 30 }} remainingSessionLiftIds={[['press']]} increments={{ press: 2.5 }} />);
    expect(screen.getByText('1 miss')).toBeInTheDocument();
    expect(screen.getByText('Holds 30 kg')).toBeInTheDocument();
  });

  it('shows a deload chip when the live weight has dropped below the last logged session', () => {
    const history = [session('2024-01-15', [['deadlift', 85, [5]]])];
    render(<WeekProgressCard history={history} liftIds={['deadlift']} weights={{ deadlift: 77.5 }} remainingSessionLiftIds={[['deadlift']]} increments={{ deadlift: 5 }} />);
    expect(screen.getByText('Deload')).toBeInTheDocument();
    expect(screen.getByText('85 → 77.5 kg')).toBeInTheDocument();
  });

  it('omits a lift from the card when it has never been trained', () => {
    const history = [session('2024-01-15', [['squat', 50, [5, 5, 5, 5, 5]]])];
    render(<WeekProgressCard history={history} liftIds={['squat', 'deadlift']} weights={{ squat: 50, deadlift: 60 }} remainingSessionLiftIds={[]} />);
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.queryByText('Deadlift')).not.toBeInTheDocument();
  });

  it('shows the day strip with a trained day, the day after as rest, and one still available', () => {
    const trainedDay = weekdayIndex(safeTrainedIdx);
    render(<WeekProgressCard history={[session(trainedDay.toISOString(), [['squat', 50, [5, 5, 5, 5, 5]]])]} remainingSessionLiftIds={[]} />);
    expect(screen.getAllByTitle('Trained')).toHaveLength(1);
    expect(screen.getAllByTitle('Rest · trained the day before')).toHaveLength(1);
  });

  it('gives each day box an accessible name that includes the full weekday, not just the state', () => {
    const trainedDay = weekdayIndex(safeTrainedIdx);
    const expectedWeekday = trainedDay.toLocaleDateString(undefined, { weekday: 'long' });
    render(<WeekProgressCard history={[session(trainedDay.toISOString(), [['squat', 50, [5, 5, 5, 5, 5]]])]} remainingSessionLiftIds={[]} />);
    const box = screen.getByRole('img', { name: new RegExp(`^${expectedWeekday}:`) });
    expect(box).toHaveAccessibleName(`${expectedWeekday}: Trained`);
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
