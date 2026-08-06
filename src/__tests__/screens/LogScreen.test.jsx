import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LogScreen from '../../screens/LogScreen';

const session = (overrides) => ({
  date: new Date('2024-01-15').toISOString(),
  type: 'A',
  preset: 'standard',
  exercises: [{ id: 'squat', name: 'squat', weight: 50, reps: 5, increment: 2.5, setsCompleted: [5, 5, 5, 5, 5] }],
  ...overrides,
});

const baseProps = {
  preset: 'standard', program: {}, weights: {}, mcTop: {}, mcInterval: 1, mcPress: 'press',
  getCurrentDay: () => 'A', setEditingEntry: vi.fn(), setDeletingEntry: vi.fn(),
  logGrouping: 'all', setLogGrouping: vi.fn(),
  expandedGroups: {}, setExpandedGroups: vi.fn(),
  expandedLogEntry: null, setExpandedLogEntry: vi.fn(),
};

describe('LogScreen miss chip', () => {
  it('reads "All reps" for a session with cleared/unlogged sets, not a miss chip', () => {
    const history = [session({
      exercises: [{ id: 'squat', name: 'squat', weight: 50, reps: 5, increment: 2.5, setsCompleted: [5, 5, null, null, null] }],
    })];
    render(<LogScreen {...baseProps} history={history} />);
    expect(screen.getByText('All reps')).toBeInTheDocument();
    expect(screen.queryByText(/miss/i)).not.toBeInTheDocument();
  });

  it('shows a 1-miss chip for a session with exactly one set below target', () => {
    const history = [session({
      exercises: [{ id: 'squat', name: 'squat', weight: 50, reps: 5, increment: 2.5, setsCompleted: [5, 5, 3, 5, 5] }],
    })];
    render(<LogScreen {...baseProps} history={history} />);
    expect(screen.getByText('1 miss')).toBeInTheDocument();
    expect(screen.queryByText('All reps')).not.toBeInTheDocument();
  });
});
