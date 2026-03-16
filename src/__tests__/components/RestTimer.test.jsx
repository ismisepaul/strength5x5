import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestTimer from '../../components/RestTimer';

describe('RestTimer', () => {
  const defaultProps = {
    seconds: 60,
    total: 90,
    isDark: true,
    isExerciseComplete: false,
    isExpired: false,
    onSkip: vi.fn(),
  };

  it('renders nothing when seconds=0 and not complete/expired', () => {
    const { container } = render(
      <RestTimer {...defaultProps} seconds={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders countdown when timer is active', () => {
    render(<RestTimer {...defaultProps} seconds={65} />);
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('Recovery Phase')).toBeInTheDocument();
    expect(screen.getByText('Skip')).toBeInTheDocument();
  });

  it('renders count-up "Lifting" state when expired', () => {
    render(<RestTimer {...defaultProps} seconds={0} isExpired={true} elapsed={5} />);
    expect(screen.getByText('Lifting')).toBeInTheDocument();
    expect(screen.getByText('0:05')).toBeInTheDocument();
  });

  it('renders "Movement Finished" when exercise is complete', () => {
    render(<RestTimer {...defaultProps} seconds={0} isExerciseComplete={true} />);
    expect(screen.getByText('Movement Finished')).toBeInTheDocument();
    expect(screen.getByText('Got it')).toBeInTheDocument();
  });

  it('calls onSkip when skip button is clicked', async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<RestTimer {...defaultProps} onSkip={onSkip} />);
    await user.click(screen.getByText('Skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when "Got it" button is clicked', async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<RestTimer {...defaultProps} seconds={0} isExerciseComplete={true} onSkip={onSkip} />);
    await user.click(screen.getByText('Got it'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does not render a button in expired state (dismissed by tapping next set)', () => {
    render(<RestTimer {...defaultProps} seconds={0} isExpired={true} elapsed={10} />);
    expect(screen.getByText('Lifting')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders "Session Complete" when isExerciseComplete is session', () => {
    render(<RestTimer {...defaultProps} seconds={0} isExerciseComplete={'session'} />);
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
    expect(screen.queryByText('Movement Finished')).not.toBeInTheDocument();
    expect(screen.getByText('Got it')).toBeInTheDocument();
  });
});
