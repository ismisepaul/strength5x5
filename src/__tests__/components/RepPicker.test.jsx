import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RepPicker from '../../components/RepPicker';

describe('RepPicker', () => {
  const ex = { id: 'squat', reps: 5 };

  it('renders one option per rep from target down to 0', () => {
    render(<RepPicker ex={ex} setIdx={0} isDark={true} onSelect={vi.fn()} onClose={vi.fn()} />);
    for (let r = 0; r <= 5; r++) {
      expect(screen.getByLabelText(`${r} reps`)).toBeInTheDocument();
    }
  });

  it('colors the target indigo, mid values red, and 0 neutral grey', () => {
    render(<RepPicker ex={ex} setIdx={0} isDark={true} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('5 reps').className).toContain('bg-indigo-600');
    expect(screen.getByLabelText('3 reps').className).toContain('bg-rose-500/10');
    expect(screen.getByLabelText('1 reps').className).toContain('bg-rose-500/10');
    const zeroClass = screen.getByLabelText('0 reps').className;
    expect(zeroClass).not.toContain('bg-rose-500/10');
    expect(zeroClass).toContain('bg-slate-800');
  });

  it('clicking 0 selects 0 reps done', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<RepPicker ex={ex} setIdx={0} isDark={true} onSelect={onSelect} onClose={vi.fn()} />);
    await user.click(screen.getByLabelText('0 reps'));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('clicking the target value selects it', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<RepPicker ex={ex} setIdx={2} isDark={true} onSelect={onSelect} onClose={vi.fn()} />);
    await user.click(screen.getByLabelText('5 reps'));
    expect(onSelect).toHaveBeenCalledWith(5);
  });
});
