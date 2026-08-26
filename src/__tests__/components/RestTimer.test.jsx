import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestTimer from '../../components/RestTimer';

// Both the digits and the wall label can coincide with other on-screen text (e.g. the
// marker label, or the digits themselves reading "5:00"), so tests grab them by their
// stable classes rather than by text content.
const digitsEl = (container) => container.querySelector('.text-\\[44px\\], .text-\\[52px\\]');
const wallEl = (container) => container.querySelector('.text-ink\\/38');

describe('RestTimer', () => {
  const defaultProps = {
    seconds: 60,
    total: 90,
    isExerciseComplete: false,
    isExpired: false,
    isActive: false,
    onSkip: vi.fn(),
    startedAt: Date.now(),
  };

  it('renders the in-session state with no controls when no timer is running', () => {
    render(<RestTimer {...defaultProps} />);
    expect(screen.getByText('In workout')).toBeInTheDocument();
    expect(screen.queryByLabelText('Skip rest')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  it('labels the session clock "This workout" rather than the specific workout type', () => {
    render(<RestTimer {...defaultProps} />);
    expect(screen.getByText('This workout')).toBeInTheDocument();
  });

  it('hides the marker and wall when no rest is pending, without changing the strip height', () => {
    // The marker/wall rows stay mounted (so starting rest can't grow the strip), just
    // empty -- hidden via opacity, not by unmounting.
    const { container } = render(<RestTimer {...defaultProps} total={0} />);
    expect(container.querySelector('.border-t-accent-300')).not.toBeInTheDocument();
    expect(wallEl(container)).toHaveStyle({ opacity: '0' });
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

  it('scales the track to the interval itself before overtime starts, not a fixed 0-5:00 span', () => {
    // A 1:30 (90s) interval gets a scale that ends at 1:30, not a fixed 5:00 -- most of
    // the strip isn't sitting empty behind a short rest. The wall label duplicates the
    // marker's own "1:30" text here (hidden via opacity, since its endpoint coincides
    // with the marker) rather than being unmounted, hence getAllByText over getByText.
    const { container } = render(<RestTimer {...defaultProps} isActive={true} seconds={80} total={90} />);
    expect(screen.getAllByText('1:30').length).toBeGreaterThan(0); // the marker label
    expect(wallEl(container)).toHaveStyle({ opacity: '0' });
  });

  it('exposes the rest target to assistive tech, since the caret conveys it by position alone', () => {
    render(<RestTimer {...defaultProps} isActive={true} seconds={80} total={90} />);
    expect(screen.getByText('Rest target 1:30')).toBeInTheDocument();
  });

  it('keeps counting past the marker into "Lift", with the overtime shown in brackets', () => {
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={5} total={90} />);
    expect(screen.getByText('Lift')).toBeInTheDocument();
    expect(digitsEl(container)).toHaveTextContent('1:35');
    expect(screen.getByText('(+0:05)')).toBeInTheDocument();
    expect(screen.queryByText(/over/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Skip rest')).not.toBeInTheDocument();
  });

  it('does not show the overtime bracket before the marker is reached', () => {
    render(<RestTimer {...defaultProps} isActive={true} seconds={65} total={90} />);
    expect(screen.queryByText(/^\(\+/)).not.toBeInTheDocument();
  });

  it('re-scales the track to the full 5:00 ceiling the instant overtime starts, not gradually', () => {
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={5} total={90} />);
    // Barely over the marker still jumps straight to the 5:00 scale in one step.
    expect(wallEl(container)).toHaveTextContent('5:00');
  });

  it('reads "Time" and freezes at the 5:00 ceiling rather than counting past it', () => {
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={300} total={90} />);
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(digitsEl(container)).toHaveTextContent('5:00');
    expect(screen.getByText('(+3:30)')).toBeInTheDocument();
  });

  it('shifts the marker label off the right edge once it sits at the ceiling', () => {
    const { container } = render(<RestTimer {...defaultProps} isActive={true} seconds={290} total={300} />);
    const label = screen.getAllByText('5:00')[0]; // the marker's own label
    expect(label.parentElement).toHaveStyle({ transform: 'translateX(-100%)' });
    expect(wallEl(container)).toHaveStyle({ opacity: '0' });
  });

  it('hides a reference tick that coincides with the marker itself', () => {
    // At a 1:30 interval the 1:30 reference tick would sit exactly under the marker --
    // redundant, so it's hidden rather than drawn twice in the same spot.
    const { container } = render(<RestTimer {...defaultProps} isActive={true} seconds={80} total={90} />);
    const ticks = container.querySelectorAll('.bg-ground\\/50');
    expect(ticks[0]).toHaveStyle({ opacity: '0' }); // 1:30 tick, coincides with the marker
    expect(ticks[1]).toHaveStyle({ opacity: '0' }); // 3:00 tick, past the current scale
  });

  it('shows both reference ticks once the scale is wide enough to hold them', () => {
    const { container } = render(<RestTimer {...defaultProps} isActive={true} seconds={290} total={300} />);
    const ticks = container.querySelectorAll('.bg-ground\\/50');
    expect(ticks[0]).toHaveStyle({ opacity: '1', left: '30%' });
    expect(ticks[1]).toHaveStyle({ opacity: '1', left: '60%' });
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
