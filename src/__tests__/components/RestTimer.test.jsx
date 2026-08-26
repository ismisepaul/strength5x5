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

  it('renders the in-session state with no controls when no timer is running', () => {
    render(<RestTimer {...defaultProps} />);
    expect(screen.getByText('In workout')).toBeInTheDocument();
    expect(screen.queryByLabelText('Skip rest')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  it('hides the marker and wall when no rest is pending', () => {
    render(<RestTimer {...defaultProps} total={0} />);
    expect(screen.queryByText('5:00')).not.toBeInTheDocument();
  });

  it('counts rest up from zero, with no skip control, while active', () => {
    render(<RestTimer {...defaultProps} isActive={true} seconds={65} total={90} />);
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByText('0:25')).toBeInTheDocument();
    expect(screen.queryByLabelText('Skip rest')).not.toBeInTheDocument();
  });

  it('renders the get-ready warning in the last five seconds before the marker', () => {
    render(<RestTimer {...defaultProps} isActive={true} seconds={5} total={90} />);
    expect(screen.getByText('Get ready')).toBeInTheDocument();
    expect(screen.getByText('1:25')).toBeInTheDocument();
    expect(screen.queryByText('Rest')).not.toBeInTheDocument();
  });

  it('renders the ordinary rest state above the five-second warning threshold', () => {
    render(<RestTimer {...defaultProps} isActive={true} seconds={6} total={90} />);
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.queryByText('Get ready')).not.toBeInTheDocument();
  });

  it('fills the countdown dots as the warning window closes', () => {
    const { container } = render(<RestTimer {...defaultProps} isActive={true} seconds={3} total={90} />);
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots).toHaveLength(5);
    expect([...dots].filter((d) => d.className.includes('bg-accent'))).toHaveLength(3);
  });

  it('shows no countdown dots outside the warning window', () => {
    const { container } = render(<RestTimer {...defaultProps} isActive={true} seconds={6} total={90} />);
    expect(container.querySelectorAll('.rounded-full')).toHaveLength(0);
  });

  it('keeps counting past the marker into "Lift", still with no skip control', () => {
    render(<RestTimer {...defaultProps} isExpired={true} elapsed={5} total={90} />);
    expect(screen.getByText('Lift')).toBeInTheDocument();
    expect(screen.getByText('1:35')).toBeInTheDocument();
    expect(screen.queryByLabelText('Skip rest')).not.toBeInTheDocument();
  });

  it('freezes the clock at the 5:00 ceiling rather than counting past it', () => {
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={300} total={90} />);
    expect(screen.getByText('Lift')).toBeInTheDocument();
    expect(container.querySelector('.text-\\[44px\\]')).toHaveTextContent('5:00');
  });

  it('shows the marker at the programmed interval and the 5:00 wall beyond it', () => {
    render(<RestTimer {...defaultProps} isActive={true} seconds={80} total={90} />);
    expect(screen.getByText('1:30')).toBeInTheDocument();
    expect(screen.getByText('5:00')).toHaveStyle({ opacity: '1' });
  });

  it('hides the 5:00 wall label once the marker sits at the ceiling', () => {
    render(<RestTimer {...defaultProps} isActive={true} seconds={290} total={300} />);
    const matches = screen.getAllByText('5:00');
    expect(matches).toHaveLength(2); // the marker label and the wall label coincide
    expect(matches[1]).toHaveStyle({ opacity: '0' });
  });

  it('renders "Movement finished" when exercise is complete', () => {
    render(<RestTimer {...defaultProps} isExerciseComplete={true} />);
    expect(screen.getByText('Movement finished')).toBeInTheDocument();
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
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
