import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseCard from '../../components/ExerciseCard';

describe('ExerciseCard', () => {
  const baseEx = {
    id: 'squat',
    name: 'Back Squat',
    weight: 60,
    sets: 5,
    reps: 5,
    increment: 2.5,
    setsCompleted: [null, null, null, null, null],
  };

  const defaultProps = {
    ex: baseEx,
    exIdx: 0,
    isDark: true,
    onToggleSet: vi.fn(),
    onShowPlates: vi.fn(),
    expanded: false,
    onToggleWarmup: vi.fn(),
    onUpdateWeight: vi.fn(),
  };

  it('renders exercise name and weight', () => {
    render(<ExerciseCard {...defaultProps} />);
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByText('60kg')).toBeInTheDocument();
  });

  it('renders 5 set buttons', () => {
    render(<ExerciseCard {...defaultProps} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it('calls onToggleSet when a set button is clicked', async () => {
    const onToggleSet = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onToggleSet={onToggleSet} />);
    await user.click(screen.getByText('1'));
    expect(onToggleSet).toHaveBeenCalledWith(0, 0);
  });

  it('calls onUpdateWeight with positive increment', async () => {
    const onUpdateWeight = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onUpdateWeight={onUpdateWeight} />);
    await user.click(screen.getByLabelText('Increase Back Squat weight'));
    expect(onUpdateWeight).toHaveBeenCalledWith(0, 2.5);
  });

  it('calls onUpdateWeight with negative increment', async () => {
    const onUpdateWeight = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onUpdateWeight={onUpdateWeight} />);
    await user.click(screen.getByLabelText('Decrease Back Squat weight'));
    expect(onUpdateWeight).toHaveBeenCalledWith(0, -2.5);
  });

  it('shows warmup section when expanded', () => {
    render(<ExerciseCard {...defaultProps} expanded={true} />);
    expect(screen.getByText('Empty Bar')).toBeInTheDocument();
    expect(screen.getByText('Working Prep')).toBeInTheDocument();
  });

  it('hides warmup section when collapsed', () => {
    render(<ExerciseCard {...defaultProps} expanded={false} />);
    expect(screen.queryByText('Empty Bar')).not.toBeInTheDocument();
  });

  it('calls onToggleWarmup when warmup button is clicked', async () => {
    const onToggleWarmup = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onToggleWarmup={onToggleWarmup} />);
    await user.click(screen.getByText('Warmup'));
    expect(onToggleWarmup).toHaveBeenCalledWith('squat');
  });

  it('calls onShowPlates when plates button is clicked', async () => {
    const onShowPlates = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onShowPlates={onShowPlates} />);
    await user.click(screen.getByText('Plates'));
    expect(onShowPlates).toHaveBeenCalledWith(baseEx);
  });

  it('shows 1x5 Target label for single-set exercise', () => {
    const deadliftEx = { ...baseEx, id: 'deadlift', name: 'Deadlift', sets: 1, setsCompleted: [null] };
    render(<ExerciseCard {...defaultProps} ex={deadliftEx} />);
    expect(screen.getByText('1x5 Target')).toBeInTheDocument();
  });

  it('displays completed reps count for done sets', () => {
    const completedEx = { ...baseEx, setsCompleted: [5, 5, 3, null, null] };
    render(<ExerciseCard {...defaultProps} ex={completedEx} />);
    const fives = screen.getAllByText('5');
    expect(fives.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('clamps warmup weight to 20kg minimum', () => {
    const lightEx = { ...baseEx, weight: 25 };
    render(<ExerciseCard {...defaultProps} ex={lightEx} expanded={true} />);
    expect(screen.getByText('20kg × 3')).toBeInTheDocument();
  });
});
