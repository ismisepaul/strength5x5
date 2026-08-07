import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeekProgressCard from '../../components/WeekProgressCard';

const session = (date, exercises) => ({
  date: new Date(date).toISOString(),
  exercises: exercises.map(([id, weight, setsCompleted]) => ({
    id, name: id, weight, sets: setsCompleted.length, reps: 5, increment: 2.5, setsCompleted,
  })),
});

describe('WeekProgressCard', () => {
  it('keeps the lift breakdown collapsed by default', () => {
    render(<WeekProgressCard history={[]} />);
    expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
  });

  it('expands the lift breakdown on tap and collapses again on a second tap', async () => {
    const user = userEvent.setup();
    const history = [session('2024-01-15', [['squat', 50, [5, 5, 5, 5, 5]]])];
    render(<WeekProgressCard history={history} />);
    const toggle = screen.getByRole('button');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Back Squat')).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Back Squat')).not.toBeInTheDocument();
  });

  it('shows a from/to weight for a lift that progressed, with no chip', async () => {
    const user = userEvent.setup();
    const history = [
      session('2024-01-15', [['squat', 50, [5, 5, 5, 5, 5]]]),
      session('2024-01-08', [['squat', 47.5, [5, 5, 5, 5, 5]]]),
    ];
    render(<WeekProgressCard history={history} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('47.5 → 50 kg')).toBeInTheDocument();
  });

  it('shows a miss chip and "holds" wording for a lift that repeated after a miss', async () => {
    const user = userEvent.setup();
    const history = [
      session('2024-01-15', [['press', 30, [5, 5, 5, 3, null]]]),
      session('2024-01-08', [['press', 30, [5, 5, 5, 5, 5]]]),
    ];
    render(<WeekProgressCard history={history} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('1 miss')).toBeInTheDocument();
    expect(screen.getByText('Holds 30 kg')).toBeInTheDocument();
  });

  it('shows a deload chip and a from/to weight for a lift that dropped', async () => {
    const user = userEvent.setup();
    const history = [
      session('2024-01-15', [['deadlift', 77.5, [5]]]),
      session('2024-01-08', [['deadlift', 85, [5]]]),
    ];
    render(<WeekProgressCard history={history} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('Deload')).toBeInTheDocument();
    expect(screen.getByText('85 → 77.5 kg')).toBeInTheDocument();
  });

  it('omits a lift from the breakdown when it has never been trained', async () => {
    const user = userEvent.setup();
    const history = [session('2024-01-15', [['squat', 50, [5, 5, 5, 5, 5]]])];
    render(<WeekProgressCard history={history} />);
    await user.click(screen.getByRole('button'));
    expect(screen.queryByText('Deadlift')).not.toBeInTheDocument();
  });
});
