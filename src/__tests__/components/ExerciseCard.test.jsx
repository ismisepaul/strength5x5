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

  it('renders 5 set buttons, each showing the goal rep count while unlogged', () => {
    render(<ExerciseCard {...defaultProps} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByLabelText(`Set ${i}`)).toBeInTheDocument();
    }
    expect(screen.getAllByText('5')).toHaveLength(5);
  });

  it('calls onToggleSet when a set button is clicked', async () => {
    const onToggleSet = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onToggleSet={onToggleSet} />);
    await user.click(screen.getByLabelText('Set 1'));
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
    expect(screen.getByText('Empty bar')).toBeInTheDocument();
    expect(screen.getByText('Working prep')).toBeInTheDocument();
  });

  it('hides warmup section when collapsed', () => {
    render(<ExerciseCard {...defaultProps} expanded={false} />);
    expect(screen.queryByText('Empty bar')).not.toBeInTheDocument();
  });

  it('calls onToggleWarmup when warmup button is clicked', async () => {
    const onToggleWarmup = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onToggleWarmup={onToggleWarmup} />);
    await user.click(screen.getByText('Warm-up'));
    expect(onToggleWarmup).toHaveBeenCalledWith('squat');
  });

  it('calls onShowPlates when plates button is clicked', async () => {
    const onShowPlates = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onShowPlates={onShowPlates} />);
    await user.click(screen.getByText('Plates'));
    expect(onShowPlates).toHaveBeenCalledWith(baseEx);
  });

  it('renders exactly 1 set target for a single-set exercise and no placeholder slots', () => {
    const deadliftEx = { ...baseEx, id: 'deadlift', name: 'Deadlift', sets: 1, setsCompleted: [null] };
    const { container } = render(<ExerciseCard {...defaultProps} ex={deadliftEx} />);
    const setButtons = screen.getAllByRole('button').filter(btn => (btn.getAttribute('aria-label') || '').startsWith('Set '));
    expect(setButtons).toHaveLength(1);
    expect(container.querySelector('.border-dashed')).not.toBeInTheDocument();
  });

  it('shows a missed-set badge and "holds next session" note when a set is under target', () => {
    const missedEx = { ...baseEx, setsCompleted: [5, 3, null, null, null] };
    render(<ExerciseCard {...defaultProps} ex={missedEx} />);
    const missedSet = screen.getByLabelText('Set 2, 3 reps');
    expect(missedSet.querySelector('svg')).toBeTruthy();
    expect(screen.getByText(/holds next session/)).toBeInTheDocument();
  });

  it('shows the teaching caption on the first exercise until a set is logged', () => {
    const { rerender } = render(<ExerciseCard {...defaultProps} showHint={true} />);
    expect(screen.getByText(/hold a set to pick an exact count/)).toBeInTheDocument();

    rerender(<ExerciseCard {...defaultProps} showHint={false} />);
    expect(screen.queryByText(/hold a set to pick an exact count/)).not.toBeInTheDocument();
  });

  it('long-pressing a set opens the rep picker via onOpenRepPicker', async () => {
    vi.useFakeTimers();
    const onOpenRepPicker = vi.fn();
    render(<ExerciseCard {...defaultProps} onOpenRepPicker={onOpenRepPicker} />);
    const firstSet = screen.getByLabelText('Set 1');
    firstSet.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(onOpenRepPicker).toHaveBeenCalledWith(0, 0);
    vi.useRealTimers();
  });

  it('shows the customized rep target, not the set number, on unlogged sets', () => {
    const customEx = { ...baseEx, reps: 8, setsCompleted: [null, null, null, null, null] };
    render(<ExerciseCard {...defaultProps} ex={customEx} />);
    expect(screen.getAllByText('8')).toHaveLength(5);
    expect(screen.queryByText('1')).not.toBeInTheDocument();
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
