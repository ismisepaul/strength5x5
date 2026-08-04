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
    onToggleSet: vi.fn(),
    onWeightChange: vi.fn(),
  };

  it('renders exercise name and weight, always typeable', () => {
    render(<ExerciseCard {...defaultProps} />);
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase Back Squat weight')).toBeInTheDocument();
    expect(screen.getByLabelText('Decrease Back Squat weight')).toBeInTheDocument();
  });

  it('commits a typed weight on blur, snapped to the increment', async () => {
    const onWeightChange = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onWeightChange={onWeightChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, '63');
    await user.tab();
    expect(onWeightChange).toHaveBeenCalledWith(62.5);
  });

  it('commits a typed weight on Enter', async () => {
    const onWeightChange = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onWeightChange={onWeightChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, '65{Enter}');
    expect(onWeightChange).toHaveBeenCalledWith(65);
  });

  it('reverts a typed weight on Escape without committing', async () => {
    const onWeightChange = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onWeightChange={onWeightChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, '65{Escape}');
    expect(onWeightChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
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

  it('calls onWeightChange with the weight plus increment when + is tapped', async () => {
    const onWeightChange = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onWeightChange={onWeightChange} />);
    await user.click(screen.getByLabelText('Increase Back Squat weight'));
    expect(onWeightChange).toHaveBeenCalledWith(62.5);
  });

  it('calls onWeightChange with the weight minus increment when - is tapped', async () => {
    const onWeightChange = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onWeightChange={onWeightChange} />);
    await user.click(screen.getByLabelText('Decrease Back Squat weight'));
    expect(onWeightChange).toHaveBeenCalledWith(57.5);
  });

  it('keeps the warm-up and bar-setup panels closed by default', () => {
    render(<ExerciseCard {...defaultProps} />);
    expect(screen.queryByText('Prep')).not.toBeInTheDocument();
    expect(screen.queryByText(/Per side/)).not.toBeInTheDocument();
  });

  it('opens the warm-up panel showing empty bar, prep, and working weight rows', async () => {
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} />);
    await user.click(screen.getByText('Warm-up'));
    expect(screen.getByText('Empty bar')).toBeInTheDocument();
    expect(screen.getByText('20 kg × 5')).toBeInTheDocument();
    expect(screen.getByText('Prep')).toBeInTheDocument();
    expect(screen.getByText('45 kg × 3')).toBeInTheDocument();
    expect(screen.getByText('Working weight')).toBeInTheDocument();
    expect(screen.getByText('60 kg × 5')).toBeInTheDocument();
  });

  it('opens the bar-setup panel showing the plate diagram and per-side caption', async () => {
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} />);
    await user.click(screen.getByText('Bar setup'));
    expect(screen.getByText('Per side · 20 kg bar · 60 total')).toBeInTheDocument();
    expect(screen.getAllByText('20').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the empty-bar caption in the bar-setup panel when weight is at the empty bar', async () => {
    const user = userEvent.setup();
    const emptyBarEx = { ...baseEx, weight: 20 };
    render(<ExerciseCard {...defaultProps} ex={emptyBarEx} />);
    await user.click(screen.getByText('Bar setup'));
    expect(screen.getByText('Empty bar · 20 kg')).toBeInTheDocument();
  });

  it('opening the bar-setup panel closes an open warm-up panel', async () => {
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} />);
    await user.click(screen.getByText('Warm-up'));
    expect(screen.getByText('Prep')).toBeInTheDocument();
    await user.click(screen.getByText('Bar setup'));
    expect(screen.queryByText('Prep')).not.toBeInTheDocument();
    expect(screen.getByText('Per side · 20 kg bar · 60 total')).toBeInTheDocument();
  });

  describe('ramped (Madcow) exercise', () => {
    const rampedEx = {
      id: 'squat',
      name: 'Back Squat',
      sets: 3,
      setWeights: [35, 45, 55],
      setReps: [5, 5, 5],
      increment: 2.5,
      weight: 55,
      setsCompleted: [null, null, null],
    };
    const rampedProps = { ...defaultProps, ex: rampedEx, setWeightMin: 20, onSetWeightChange: vi.fn() };

    it('shows the bar setup for the set in progress, not the top set', async () => {
      const user = userEvent.setup();
      render(<ExerciseCard {...rampedProps} />);
      await user.click(screen.getByText('Bar setup'));
      expect(screen.getByText('Per side · 20 kg bar · 35 total')).toBeInTheDocument();
    });

    it('advances the bar setup to the next set once the current one is logged', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ExerciseCard {...rampedProps} />);
      await user.click(screen.getByText('Bar setup'));
      expect(screen.getByText('Per side · 20 kg bar · 35 total')).toBeInTheDocument();

      // Re-render as the app would after set 1 is logged -- the panel stays open and
      // should track set 2's weight without the user re-opening it.
      const afterSet1 = { ...rampedEx, setsCompleted: [5, null, null] };
      rerender(<ExerciseCard {...rampedProps} ex={afterSet1} />);
      expect(screen.getByText('Per side · 20 kg bar · 45 total')).toBeInTheDocument();
    });
  });

  it('renders exactly 1 set target for a single-set exercise and no placeholder slots', () => {
    const deadliftEx = { ...baseEx, id: 'deadlift', name: 'Deadlift', sets: 1, setsCompleted: [null] };
    render(<ExerciseCard {...defaultProps} ex={deadliftEx} />);
    const setButtons = screen.getAllByRole('button').filter(btn => (btn.getAttribute('aria-label') || '').startsWith('Set '));
    expect(setButtons).toHaveLength(1);
    expect(setButtons[0].querySelector('svg')).not.toBeInTheDocument();
  });

  it('shows a missed-set badge and "holds next session" note when a set is under target', () => {
    const missedEx = { ...baseEx, setsCompleted: [5, 3, null, null, null] };
    render(<ExerciseCard {...defaultProps} ex={missedEx} />);
    const missedSet = screen.getByLabelText('Set 2, 3 reps');
    expect(missedSet.querySelector('svg')).toBeTruthy();
    expect(screen.getByText(/keep weight at .* next session/)).toBeInTheDocument();
  });

  it('gives the missed-set ring a transparent border, keeping the same border width', () => {
    const missedEx = { ...baseEx, setsCompleted: [5, 3, null, null, null] };
    render(<ExerciseCard {...defaultProps} ex={missedEx} />);
    const missedSet = screen.getByLabelText('Set 2, 3 reps');
    expect(missedSet.className).toContain('border-[1.5px]');
    expect(missedSet.className).toContain('border-transparent');
    expect(missedSet.className).not.toContain('border-dashed');
  });

  it('uses a fixed dash length with a gap that widens per missed rep', () => {
    const missedEx = { ...baseEx, setsCompleted: [3, null, null, null, null] }; // 2 short of 5
    render(<ExerciseCard {...defaultProps} ex={missedEx} />);
    const missedSet = screen.getByLabelText('Set 1, 3 reps');
    const circle = missedSet.querySelector('circle');
    expect(circle).toBeTruthy();
    expect(circle.getAttribute('stroke-dasharray')).toBe('3 6'); // gap = 3 * (5 - 3)
    expect(circle.getAttribute('stroke')).toBe('rgba(233,233,237,.55)');
  });

  it('mimics a classic fine dashed border when exactly one rep short', () => {
    const missedEx = { ...baseEx, setsCompleted: [4, null, null, null, null] }; // 1 short of 5
    render(<ExerciseCard {...defaultProps} ex={missedEx} />);
    const missedSet = screen.getByLabelText('Set 1, 4 reps');
    const circle = missedSet.querySelector('circle');
    expect(circle.getAttribute('stroke-dasharray')).toBe('3 3'); // dash === gap
  });

  it('varies the gap with a different rep target', () => {
    const customEx = { ...baseEx, reps: 8, setsCompleted: [2, null, null, null, null] }; // 6 short of 8
    render(<ExerciseCard {...defaultProps} ex={customEx} />);
    const missedSet = screen.getByLabelText('Set 1, 2 reps');
    const circle = missedSet.querySelector('circle');
    expect(circle.getAttribute('stroke-dasharray')).toBe('3 18'); // gap = 3 * (8 - 2)
  });

  it('clamps the gap at 24 for a badly missed set', () => {
    const customEx = { ...baseEx, reps: 10, setsCompleted: [1, null, null, null, null] }; // 9 short of 10
    render(<ExerciseCard {...defaultProps} ex={customEx} />);
    const missedSet = screen.getByLabelText('Set 1, 1 reps');
    const circle = missedSet.querySelector('circle');
    expect(circle.getAttribute('stroke-dasharray')).toBe('3 24'); // 3 * 9 = 27, clamped to 24
  });

  it('uses faint specks for a fully missed (0-rep) set regardless of the formula', () => {
    const missedEx = { ...baseEx, setsCompleted: [0, null, null, null, null] };
    render(<ExerciseCard {...defaultProps} ex={missedEx} />);
    const missedSet = screen.getByLabelText('Set 1, 0 reps');
    const circle = missedSet.querySelector('circle');
    expect(circle.getAttribute('stroke-dasharray')).toBe('0.5 24');
  });

  it('shows the teaching caption on the first exercise until a set is logged', () => {
    const { rerender } = render(<ExerciseCard {...defaultProps} showHint={true} />);
    expect(screen.getByText(/Long-press to set exact count/)).toBeInTheDocument();

    rerender(<ExerciseCard {...defaultProps} showHint={false} />);
    expect(screen.queryByText(/Long-press to set exact count/)).not.toBeInTheDocument();
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

  it('long-pressing a set with a mouse also opens the rep picker', async () => {
    vi.useFakeTimers();
    const onOpenRepPicker = vi.fn();
    render(<ExerciseCard {...defaultProps} onOpenRepPicker={onOpenRepPicker} />);
    const firstSet = screen.getByLabelText('Set 1');
    firstSet.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    vi.advanceTimersByTime(500);
    expect(onOpenRepPicker).toHaveBeenCalledWith(0, 0);
    vi.useRealTimers();
  });

  it('suppresses the context menu on set buttons', () => {
    render(<ExerciseCard {...defaultProps} />);
    const firstSet = screen.getByLabelText('Set 1');
    const event = new Event('contextmenu', { bubbles: true, cancelable: true });
    firstSet.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
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

  it('computes the prep weight as 60% of the way from the empty bar to the working weight', async () => {
    const user = userEvent.setup();
    const lightEx = { ...baseEx, weight: 25 };
    render(<ExerciseCard {...defaultProps} ex={lightEx} />);
    await user.click(screen.getByText('Warm-up'));
    expect(screen.getByText('22.5 kg × 3')).toBeInTheDocument();
  });

  it('calls onOpenGuide when the exercise name info button is tapped', async () => {
    const onOpenGuide = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseCard {...defaultProps} onOpenGuide={onOpenGuide} />);
    await user.click(screen.getByLabelText('How to perform Back Squat'));
    expect(onOpenGuide).toHaveBeenCalledTimes(1);
  });
});
