import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestIntervalControl from '../../components/RestIntervalControl';
import { CUSTOM_REST_MIN, CUSTOM_REST_MAX, CUSTOM_REST_STEP } from '../../constants';

// The track has no real layout in jsdom (getBoundingClientRect returns all zeros), so
// drag tests stub it to a fixed 200px width starting at x=0. setPointerCapture isn't
// implemented in jsdom at all, so it's stubbed to a no-op rather than left to throw.
const stubTrack = (track) => {
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 200, top: 0, height: 44, right: 200, bottom: 44 });
  track.setPointerCapture = vi.fn();
  track.releasePointerCapture = vi.fn();
  return track;
};

describe('RestIntervalControl', () => {
  it('renders as a slider with the current bounds and value exposed to assistive tech', () => {
    render(<RestIntervalControl preferredRest={90} setPreferredRest={vi.fn()} />);
    const track = screen.getByRole('slider', { name: 'Rest interval' });
    expect(track).toHaveAttribute('aria-valuemin', String(CUSTOM_REST_MIN));
    expect(track).toHaveAttribute('aria-valuemax', String(CUSTOM_REST_MAX));
    expect(track).toHaveAttribute('aria-valuenow', '90');
    expect(track).toHaveAttribute('aria-valuetext', '1:30');
  });

  it('commits a snapped value on pointer-down at the track midpoint', () => {
    const setPreferredRest = vi.fn();
    render(<RestIntervalControl preferredRest={90} setPreferredRest={setPreferredRest} />);
    const track = stubTrack(screen.getByRole('slider', { name: 'Rest interval' }));

    // Midpoint of a 200px track over 30..300 (270s range) is 30+135=165, snapped to 170.
    fireEvent.pointerDown(track, { clientX: 100, pointerId: 1 });
    expect(setPreferredRest).toHaveBeenCalledWith(170);
  });

  it('keeps committing while the pointer moves after pointer-down, and stops once it lifts', () => {
    const setPreferredRest = vi.fn();
    render(<RestIntervalControl preferredRest={90} setPreferredRest={setPreferredRest} />);
    const track = stubTrack(screen.getByRole('slider', { name: 'Rest interval' }));

    fireEvent.pointerDown(track, { clientX: 0, pointerId: 1 });
    expect(setPreferredRest).toHaveBeenLastCalledWith(30);
    fireEvent.pointerMove(track, { clientX: 200, pointerId: 1 });
    expect(setPreferredRest).toHaveBeenLastCalledWith(300);

    fireEvent.pointerUp(track, { clientX: 200, pointerId: 1 });
    setPreferredRest.mockClear();
    fireEvent.pointerMove(track, { clientX: 0, pointerId: 1 });
    expect(setPreferredRest).not.toHaveBeenCalled();
  });

  it('clamps a drag past either end of the track to its bound', () => {
    const setPreferredRest = vi.fn();
    render(<RestIntervalControl preferredRest={90} setPreferredRest={setPreferredRest} />);
    const track = stubTrack(screen.getByRole('slider', { name: 'Rest interval' }));

    fireEvent.pointerDown(track, { clientX: -100, pointerId: 1 });
    expect(setPreferredRest).toHaveBeenLastCalledWith(CUSTOM_REST_MIN);
    fireEvent.pointerUp(track, { clientX: -100, pointerId: 1 });

    fireEvent.pointerDown(track, { clientX: 1000, pointerId: 2 });
    expect(setPreferredRest).toHaveBeenLastCalledWith(CUSTOM_REST_MAX);
  });

  it('moves by one step per arrow key and jumps to the bounds with Home/End', async () => {
    const user = userEvent.setup();
    const setPreferredRest = vi.fn();
    const { rerender } = render(<RestIntervalControl preferredRest={90} setPreferredRest={setPreferredRest} />);
    screen.getByRole('slider', { name: 'Rest interval' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(setPreferredRest).toHaveBeenLastCalledWith(90 + CUSTOM_REST_STEP);

    rerender(<RestIntervalControl preferredRest={90} setPreferredRest={setPreferredRest} />);
    await user.keyboard('{ArrowLeft}');
    expect(setPreferredRest).toHaveBeenLastCalledWith(90 - CUSTOM_REST_STEP);

    await user.keyboard('{Home}');
    expect(setPreferredRest).toHaveBeenLastCalledWith(CUSTOM_REST_MIN);
    await user.keyboard('{End}');
    expect(setPreferredRest).toHaveBeenLastCalledWith(CUSTOM_REST_MAX);
  });

  it('raises the short-rest notice for a drag landing below one minute, and clears it above', () => {
    const setPreferredRest = vi.fn();
    const { rerender } = render(<RestIntervalControl preferredRest={90} setPreferredRest={setPreferredRest} />);
    const track = stubTrack(screen.getByRole('slider', { name: 'Rest interval' }));

    fireEvent.pointerDown(track, { clientX: 0, pointerId: 1 }); // lands on the 30s floor
    expect(screen.getByText(/not enough to recover/)).toBeInTheDocument();
    fireEvent.pointerUp(track, { clientX: 0, pointerId: 1 });

    rerender(<RestIntervalControl preferredRest={30} setPreferredRest={setPreferredRest} />);
    const track2 = stubTrack(screen.getByRole('slider', { name: 'Rest interval' }));
    fireEvent.pointerDown(track2, { clientX: 200, pointerId: 2 }); // drags up to the ceiling
    expect(screen.queryByText(/not enough to recover/)).not.toBeInTheDocument();
  });

  it('positions the handle at the value\'s position on the track', () => {
    const { container, rerender } = render(<RestIntervalControl preferredRest={CUSTOM_REST_MIN} setPreferredRest={vi.fn()} />);
    const handleAt = () => container.querySelector('[aria-hidden="true"].bg-accent.rounded-full');
    expect(handleAt()).toHaveStyle({ left: '0%' });

    rerender(<RestIntervalControl preferredRest={CUSTOM_REST_MAX} setPreferredRest={vi.fn()} />);
    expect(handleAt()).toHaveStyle({ left: '100%' });
  });
});
