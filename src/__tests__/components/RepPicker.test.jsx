import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RepPicker from '../../components/RepPicker';

describe('RepPicker', () => {
  const ex = { id: 'squat', reps: 5 };

  it('renders one option per rep from target down to 0', () => {
    render(<RepPicker ex={ex} setIdx={0} onSelect={vi.fn()} onClose={vi.fn()} />);
    for (let r = 0; r <= 5; r++) {
      expect(screen.getByLabelText(`${r} reps`)).toBeInTheDocument();
    }
  });

  it('gives the target a stronger accent border and leaves other values ink-outlined', () => {
    render(<RepPicker ex={ex} setIdx={0} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText('5 reps').className).toContain('border-accent');
    expect(screen.getByLabelText('3 reps').className).toContain('border-ink/18');
    expect(screen.getByLabelText('1 reps').className).toContain('border-ink/18');
    expect(screen.getByLabelText('0 reps').className).toContain('border-ink/18');
  });

  it('clicking 0 selects 0 reps done', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<RepPicker ex={ex} setIdx={0} onSelect={onSelect} onClose={vi.fn()} />);
    await user.click(screen.getByLabelText('0 reps'));
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('clicking the target value selects it', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<RepPicker ex={ex} setIdx={2} onSelect={onSelect} onClose={vi.fn()} />);
    await user.click(screen.getByLabelText('5 reps'));
    expect(onSelect).toHaveBeenCalledWith(5);
  });

  it('clicking Clear set calls onSelect with null', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<RepPicker ex={ex} setIdx={0} onSelect={onSelect} onClose={vi.fn()} />);
    await user.click(screen.getByText('Clear set'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('clicking Cancel calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RepPicker ex={ex} setIdx={0} onSelect={vi.fn()} onClose={onClose} />);
    await user.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
