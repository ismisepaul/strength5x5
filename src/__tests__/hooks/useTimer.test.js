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
    expect(result.current.isActive).toBe(true);
    expect(result.current.isExpired).toBe(false);
  });

  it('counts down over time', () => {
    const { result } = renderHook(() => useTimer());
    act(() => result.current.start(10));

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.seconds).toBeLessThanOrEqual(5);
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
    expect(result.current.isActive).toBe(false);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.elapsed).toBe(0);
  });
});
