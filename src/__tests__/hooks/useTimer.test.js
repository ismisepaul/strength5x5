import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimer } from '../../hooks/useTimer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTimer', () => {
  it('starts with idle state', () => {
    const { result } = renderHook(() => useTimer());
    expect(result.current.seconds).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.elapsed).toBe(0);
  });

  it('starts countdown when start() is called', () => {
    const { result } = renderHook(() => useTimer());
    act(() => result.current.start(90));
    expect(result.current.seconds).toBe(90);
    expect(result.current.duration).toBe(90);
    expect(result.current.isActive).toBe(true);
    expect(result.current.isExpired).toBe(false);
  });

  it('counts down over time while duration holds steady at the original length', () => {
    const { result } = renderHook(() => useTimer());
    act(() => result.current.start(10));

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.seconds).toBeLessThanOrEqual(5);
    expect(result.current.duration).toBe(10);
    expect(result.current.isActive).toBe(true);
  });

  it('expires when countdown reaches zero and calls onExpire', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useTimer({ onExpire }));
    act(() => result.current.start(3));

    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.isActive).toBe(false);
    expect(result.current.isExpired).toBe(true);
    expect(result.current.seconds).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('counts elapsed time upward after expiry', () => {
    const { result } = renderHook(() => useTimer());
    act(() => result.current.start(1));

    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.isExpired).toBe(true);
    expect(result.current.elapsed).toBe(0);

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsed).toBeGreaterThanOrEqual(2);
  });

  it('skip() transitions from countdown to expired without calling onExpire', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useTimer({ onExpire }));
    act(() => result.current.start(90));

    expect(result.current.isActive).toBe(true);
    expect(result.current.isExpired).toBe(false);

    act(() => result.current.skip());
    expect(result.current.isActive).toBe(false);
    expect(result.current.isExpired).toBe(true);
    expect(result.current.seconds).toBe(0);
    expect(result.current.elapsed).toBe(0);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('elapsed counts up after skip()', () => {
    const { result } = renderHook(() => useTimer());
    act(() => result.current.start(90));
    act(() => result.current.skip());

    expect(result.current.isExpired).toBe(true);

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.elapsed).toBeGreaterThanOrEqual(4);
  });

  it('reset() clears all state', () => {
    const { result } = renderHook(() => useTimer());
    act(() => result.current.start(10));
    act(() => vi.advanceTimersByTime(11000));
    expect(result.current.isExpired).toBe(true);

    act(() => result.current.reset());
    expect(result.current.seconds).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.elapsed).toBe(0);
  });

  it('stop() clears countdown without setting expired', () => {
    const { result } = renderHook(() => useTimer());
    act(() => result.current.start(60));

    act(() => result.current.stop());
    expect(result.current.seconds).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.elapsed).toBe(0);
  });

  describe('retarget()', () => {
    it('does nothing when no rest is currently running', () => {
      const { result } = renderHook(() => useTimer());
      act(() => result.current.retarget(120));
      expect(result.current.isActive).toBe(false);
      expect(result.current.isExpired).toBe(false);
      expect(result.current.duration).toBe(0);
    });

    it('extends an active countdown when the new duration is later, keeping elapsed time', () => {
      const { result } = renderHook(() => useTimer());
      act(() => result.current.start(90));
      act(() => vi.advanceTimersByTime(20000)); // ~20s elapsed, ~70s left

      act(() => result.current.retarget(180));
      expect(result.current.isActive).toBe(true);
      expect(result.current.isExpired).toBe(false);
      expect(result.current.duration).toBe(180);
      // ~20s already elapsed against the new 180s target leaves ~160s.
      expect(result.current.seconds).toBeGreaterThanOrEqual(159);
      expect(result.current.seconds).toBeLessThanOrEqual(160);
    });

    it('flips an active countdown straight to expired when the new duration has already passed', () => {
      const { result } = renderHook(() => useTimer());
      act(() => result.current.start(90));
      act(() => vi.advanceTimersByTime(30000)); // 30s elapsed

      act(() => result.current.retarget(20)); // already 10s past a 20s target
      expect(result.current.isActive).toBe(false);
      expect(result.current.isExpired).toBe(true);
      expect(result.current.duration).toBe(20);
      expect(result.current.seconds).toBe(0);
      expect(result.current.elapsed).toBeGreaterThanOrEqual(9);
      expect(result.current.elapsed).toBeLessThanOrEqual(10);
    });

    it('resumes counting down after expiry when the new duration is later than total elapsed', () => {
      const onExpire = vi.fn();
      const { result } = renderHook(() => useTimer({ onExpire }));
      act(() => result.current.start(10));
      act(() => vi.advanceTimersByTime(10000)); // expires exactly at 10s
      expect(result.current.isExpired).toBe(true);
      // The overtime ticker is a newly-mounted effect as of the transition above, so it
      // needs its own act() to actually tick -- same reason the "counts elapsed time
      // upward after expiry" test above splits its advance into two calls.
      act(() => vi.advanceTimersByTime(1000)); // ~1s of overtime
      onExpire.mockClear();

      act(() => result.current.retarget(30)); // ~11s total elapsed, 30s target -> ~19s left
      expect(result.current.isActive).toBe(true);
      expect(result.current.isExpired).toBe(false);
      expect(result.current.duration).toBe(30);
      expect(result.current.seconds).toBeGreaterThanOrEqual(18);
      expect(result.current.seconds).toBeLessThanOrEqual(20);
      expect(onExpire).not.toHaveBeenCalled();
    });
  });
});
