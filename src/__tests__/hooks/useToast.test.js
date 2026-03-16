import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../../hooks/useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('adds a toast and auto-dismisses after default info duration (3s)', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Hello'));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Hello');
    expect(result.current.toasts[0].type).toBe('info');

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('success type auto-dismisses after 2s', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Saved', 'success'));
    expect(result.current.toasts).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1999));
    expect(result.current.toasts).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('error type auto-dismisses after 4s', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Failed', 'error'));

    act(() => vi.advanceTimersByTime(3999));
    expect(result.current.toasts).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('supports custom duration override', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.showToast('Quick', 'info', 500));

    act(() => vi.advanceTimersByTime(499));
    expect(result.current.toasts).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toasts).toHaveLength(0);
  });

  it('evicts oldest toast when queue exceeds 3 (push-then-evict)', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('A', 'info', 10000);
      result.current.showToast('B', 'info', 10000);
      result.current.showToast('C', 'info', 10000);
    });
    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts.map(t => t.message)).toEqual(['A', 'B', 'C']);

    act(() => result.current.showToast('D', 'info', 10000));
    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts.map(t => t.message)).toEqual(['B', 'C', 'D']);
  });
});
