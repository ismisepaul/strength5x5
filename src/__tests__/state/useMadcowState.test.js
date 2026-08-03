import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMadcowState } from '../../state/useMadcowState';
import { INITIAL_WEIGHTS } from '../../constants';

describe('useMadcowState', () => {
  it('defaults every field when saved is empty', () => {
    const { result } = renderHook(() => useMadcowState({}));
    expect(result.current.mcTop.squat).toBe(INITIAL_WEIGHTS.squat);
    expect(result.current.mcWeek).toBe(1);
    expect(result.current.mcPending).toEqual([]);
  });

  it('normalizes mcTop against saved weights when saved.mcTop is absent', () => {
    const { result } = renderHook(() => useMadcowState({ weights: { ...INITIAL_WEIGHTS, squat: 80 } }));
    expect(result.current.mcTop.squat).toBeGreaterThan(0);
  });

  it('setters update their own field only', () => {
    const { result } = renderHook(() => useMadcowState({}));
    act(() => { result.current.setMcWeek(3); });
    expect(result.current.mcWeek).toBe(3);
    expect(result.current.mcPending).toEqual([]);
  });

  describe('hydrate', () => {
    it('updates only the fields present in the payload', () => {
      const { result } = renderHook(() => useMadcowState({}));
      const weightsBefore = result.current.mcTop;
      act(() => { result.current.hydrate({ mcWeek: 5 }, {}); });
      expect(result.current.mcWeek).toBe(5);
      expect(result.current.mcTop).toBe(weightsBefore);
    });

    it('falls back to the passed-in weights when the payload has none', () => {
      const { result } = renderHook(() => useMadcowState({}));
      act(() => { result.current.hydrate({ mcTop: { squat: 100 } }, { squat: 100, bench: 60, row: 50, press: 40, deadlift: 120 }); });
      expect(result.current.mcTop.squat).toBeGreaterThan(0);
    });

    it('treats an empty pending array as present (uses !== undefined, not truthiness)', () => {
      const { result } = renderHook(() => useMadcowState({ mcPending: ['squat'] }));
      expect(result.current.mcPending).toEqual(['squat']);
      act(() => { result.current.hydrate({ mcPending: [] }, {}); });
      expect(result.current.mcPending).toEqual([]);
    });
  });
});
