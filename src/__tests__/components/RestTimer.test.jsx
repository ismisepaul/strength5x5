import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestTimer from '../../components/RestTimer';

// Both the digits and the wall label can coincide with other on-screen text (e.g. the
// marker label, or the digits themselves reading "5:00"), so tests grab them by their
// stable classes rather than by text content.
const digitsEl = (container) => container.querySelector('.text-\\[44px\\], .text-\\[52px\\]');
const wallEl = (container) => container.querySelector('.text-ink\\/38');
// The wash overlay is the only aria-hidden element with pointer-events-none -- the
// marker caret and the reference ticks are aria-hidden too, but none carry that class.
const wash = (container) => container.querySelector('[aria-hidden="true"].pointer-events-none');

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

  it('labels the session clock "Workout" rather than the specific workout type', () => {
    render(<RestTimer {...defaultProps} />);
    expect(screen.getByText('Workout')).toBeInTheDocument();
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

  it('shows a state glyph beside the kicker for each of the three resting states', () => {
    // Hourglass while resting, HourglassLow inside the five-second warning, Barbell
    // once over the marker -- a silhouette change instead of a reading task, since
    // nothing else on the strip is guaranteed to be animating once the ceiling settles.
    const { container: resting } = render(<RestTimer {...defaultProps} isActive={true} seconds={60} total={90} />);
    expect(resting.querySelector('[data-state-icon] svg')).toBeInTheDocument();

    const { container: warning } = render(<RestTimer {...defaultProps} isActive={true} seconds={4} total={90} />);
    expect(warning.querySelector('[data-state-icon] svg')).toBeInTheDocument();

    const { container: over } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={5} total={90} />);
    expect(over.querySelector('[data-state-icon] svg')).toBeInTheDocument();
  });

  it('hides the state glyph from assistive tech, since the kicker text already carries the state', () => {
    const { container } = render(<RestTimer {...defaultProps} isActive={true} seconds={60} total={90} />);
    expect(container.querySelector('[data-state-icon] svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows no state glyph outside of rest -- its presence alone means rest is running', () => {
    const { container: inSession } = render(<RestTimer {...defaultProps} />);
    expect(inSession.querySelector('[data-state-icon]')).not.toBeInTheDocument();

    const { container: movementDone } = render(<RestTimer {...defaultProps} isExerciseComplete="movement" />);
    expect(movementDone.querySelector('[data-state-icon]')).not.toBeInTheDocument();

    const { container: workoutDone } = render(<RestTimer {...defaultProps} isExerciseComplete="workout" />);
    expect(workoutDone.querySelector('[data-state-icon]')).not.toBeInTheDocument();
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

  it('shows "Lift" immediately on expiry, not a brief flash back to "Rest"', () => {
    // useTimer batches the expiry transition (isActive -> false, isExpired -> true,
    // elapsed reset to 0) into a single render, and elapsed's own tracking effect only
    // increments once a full second has passed -- so `over` (rawElapsed - marker) is
    // still exactly 0 on this very first expired render. The kicker used to key "Lift"
    // off `over > 0`, which isn't true yet here, and isWarning is false too (it
    // requires isActive, which just went false), so it fell through to "Rest" for up to
    // a second before `over` ticked up. `isExpired` alone is the right signal: once
    // expired, we're always in the Lift phase, whether or not any overtime has
    // accumulated.
    render(<RestTimer {...defaultProps} isActive={false} isExpired={true} seconds={0} elapsed={0} total={90} />);
    expect(screen.getByText('Lift')).toBeInTheDocument();
    expect(screen.queryByText('Rest')).not.toBeInTheDocument();
    expect(screen.queryByText('Get ready')).not.toBeInTheDocument();
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

  it('fills the overtime bar close to the primary accent before the ceiling, and exactly matching it at the ceiling', () => {
    // Scoped to the track itself (its one bg-ink/14 element) -- the ceiling's own
    // flashing flood also carries a bare bg-accent class, elsewhere in the strip.
    const { container: over } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={5} total={90} />);
    const track = over.querySelector('.bg-ink\\/14');
    expect(track.querySelector('.bg-accent\\/70')).toBeInTheDocument();

    const { container: atCeiling } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={300} total={90} />);
    const ceilingTrack = atCeiling.querySelector('.bg-ink\\/14');
    // Solid bg-accent, the same fill the primary segment uses -- the whole bar reads as
    // one continuous block once there really should be no more rest.
    expect(ceilingTrack.querySelector('.bg-accent\\/70')).not.toBeInTheDocument();
    expect(ceilingTrack.querySelector('.bg-accent')).toBeInTheDocument();
  });

  it('re-scales to the next rest preset above the marker, not straight to the 5:00 ceiling', () => {
    // A 1:30 marker's next preset is 3:00 -- overtime borrows that much room first,
    // not the full 5:00 track a longer interval would eventually need.
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={5} total={90} />);
    expect(wallEl(container)).toHaveTextContent('3:00');
  });

  it('only re-scales to the full 5:00 track once overtime also runs past the 3:00 preset', () => {
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={100} total={90} />);
    // 90s marker + 100s over = 190s elapsed, past the intermediate 3:00 (180s) stop.
    expect(wallEl(container)).toHaveTextContent('5:00');
  });

  it('skips the intermediate 3:00 stop when the marker itself is already past it', () => {
    // A 3:00 interval running long has nowhere to go but straight to the 5:00 ceiling --
    // there's no shorter preset above it to borrow room from first.
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={5} total={180} />);
    expect(wallEl(container)).toHaveTextContent('5:00');
  });

  it('keeps reading "Lift" and freezes at the 5:00 ceiling rather than counting past it', () => {
    // Still "Lift", not a separate "Time" state -- the lifter is just as much still
    // lifting at 5:00 over as at 10 seconds over.
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={300} total={90} />);
    expect(screen.getByText('Lift')).toBeInTheDocument();
    expect(digitsEl(container)).toHaveTextContent('5:00');
    expect(screen.getByText('(+5:00)')).toBeInTheDocument();
  });

  it('flashes the same breathing warning treatment at the 5:00 ceiling as the five-second warning', () => {
    // Reuses isWarning's own flood/thick-bar/big-digit package rather than a separate
    // "ceiling" treatment -- the same "pay attention now" language. 90s marker + 220s
    // elapsed = 310s raw, past the 300s ceiling but inside its 30s hold before the wash
    // starts to fade.
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={220} total={90} />);
    expect(container.querySelector('.animate-\\[warnBreathe_1s_ease-in-out_infinite\\]')).toBeInTheDocument();
    expect(wash(container)).toHaveStyle({ opacity: '1' });
    expect(digitsEl(container)).toHaveClass('text-[52px]');
  });

  it('fades the ceiling wash out once it has held for 30s, without touching digit size or the bar', () => {
    // 90s marker + 250s elapsed = 340s raw, 40s past the 300s ceiling -- past the 30s
    // hold, so the wash is fading. Nothing else moves: the "pay attention" size and the
    // thick bar are keyed off staying at the ceiling, not off the wash's own visibility,
    // so the fade doesn't cause a second reflow on top of the one that got it here.
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={250} total={90} />);
    expect(wash(container)).toHaveStyle({ opacity: '0', transition: 'opacity 2600ms ease' });
    expect(digitsEl(container)).toHaveClass('text-[52px]');
    expect(screen.getByText('Lift')).toBeInTheDocument();
  });

  it('snaps the five-second warning wash on and off with no fade, unlike the ceiling', () => {
    const { container } = render(<RestTimer {...defaultProps} isActive={true} seconds={3} total={90} />);
    expect(wash(container)).toHaveStyle({ opacity: '1', transition: 'none' });
  });

  it('keeps the overtime bracket counting up past the 5:00 ceiling instead of freezing it too', () => {
    // 90s interval + 400s elapsed since expiry = 490s raw -- well past the 5:00 (300s)
    // ceiling that freezes the main digits. The bracket isn't capped there: it reads the
    // full 400s delta (+6:40), not 210s (+3:30) the way it would if it inherited the
    // digits' own cap.
    const { container } = render(<RestTimer {...defaultProps} isExpired={true} elapsed={400} total={90} />);
    expect(digitsEl(container)).toHaveTextContent('5:00');
    expect(screen.getByText('(+6:40)')).toBeInTheDocument();
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
    // The label under each tick follows the same visibility rule as the tick itself.
    const labels = container.querySelectorAll('.text-ink\\/38');
    expect(labels[1]).toHaveStyle({ opacity: '0' }); // 1:30 label
    expect(labels[2]).toHaveStyle({ opacity: '0' }); // 3:00 label
  });

  it('shows both reference ticks once the scale is wide enough to hold them', () => {
    const { container } = render(<RestTimer {...defaultProps} isActive={true} seconds={290} total={300} />);
    const ticks = container.querySelectorAll('.bg-ground\\/50');
    expect(ticks[0]).toHaveStyle({ opacity: '1', left: '30%' });
    expect(ticks[1]).toHaveStyle({ opacity: '1', left: '60%' });
    const labels = container.querySelectorAll('.text-ink\\/38');
    expect(labels[1]).toHaveStyle({ opacity: '1', left: '30%' });
    expect(labels[1]).toHaveTextContent('1:30');
    expect(labels[2]).toHaveStyle({ opacity: '1', left: '60%' });
    expect(labels[2]).toHaveTextContent('3:00');
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
