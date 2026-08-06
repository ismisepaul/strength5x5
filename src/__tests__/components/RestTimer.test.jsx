import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestTimer from '../../components/RestTimer';

describe('RestTimer', () => {
  const defaultProps = {
    seconds: 60,
    total: 90,
    isExerciseComplete: false,
    isExpired: false,
    isActive: false,
    onSkip: vi.fn(),
    startedAt: Date.now(),
    workoutType: 'A',
  };

  it('renders the in-session state with no skip button when no timer is running', () => {
    render(<RestTimer {...defaultProps} />);
    expect(screen.getByText('In workout')).toBeInTheDocument();
    expect(screen.queryByLabelText('Skip rest')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  it('renders countdown when timer is active', () => {
    render(<RestTimer {...defaultProps} isActive={true} seconds={65} />);
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByLabelText('Skip rest')).toBeInTheDocument();
  });

  it('renders count-up "Lifting" state when expired', () => {
    render(<RestTimer {...defaultProps} isExpired={true} elapsed={5} />);
    expect(screen.getByText('Lifting')).toBeInTheDocument();
    expect(screen.getByText('0:05')).toBeInTheDocument();
    expect(screen.getByLabelText('Skip rest')).toBeInTheDocument();
  });

  it('renders "Movement finished" when exercise is complete', () => {
    render(<RestTimer {...defaultProps} isExerciseComplete={true} />);
    expect(screen.getByText('Movement finished')).toBeInTheDocument();
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });

  it('calls onSkip when the skip icon button is clicked', async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<RestTimer {...defaultProps} isActive={true} onSkip={onSkip} />);
    await user.click(screen.getByLabelText('Skip rest'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when the dismiss icon button is clicked', async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<RestTimer {...defaultProps} isExerciseComplete={true} onSkip={onSkip} />);
    await user.click(screen.getByLabelText('Dismiss'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('renders "Workout complete" when isExerciseComplete is workout', () => {
    render(<RestTimer {...defaultProps} isExerciseComplete="workout" />);
    expect(screen.getByText('Workout complete')).toBeInTheDocument();
    expect(screen.queryByText('Movement finished')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });
});
