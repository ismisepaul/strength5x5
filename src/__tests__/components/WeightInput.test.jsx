import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeightInput from '../../components/WeightInput';

describe('WeightInput', () => {
  const defaultProps = {
    value: 60,
    increment: 2.5,
    min: 20,
    onChange: vi.fn(),
    label: 'Back Squat',
    isDark: true,
  };

  it('always shows the current value, with steppers immediately tappable', () => {
    render(<WeightInput {...defaultProps} />);
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
    expect(screen.getByLabelText('Decrease Back Squat weight')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase Back Squat weight')).toBeInTheDocument();
  });

  it('steps up by the increment', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} onChange={onChange} />);
    await user.click(screen.getByLabelText('Increase Back Squat weight'));
    expect(onChange).toHaveBeenCalledWith(62.5);
  });

  it('steps down by the increment', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} onChange={onChange} />);
    await user.click(screen.getByLabelText('Decrease Back Squat weight'));
    expect(onChange).toHaveBeenCalledWith(57.5);
  });

  it('clamps stepping down at the floor', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} value={20} onChange={onChange} />);
    await user.click(screen.getByLabelText('Decrease Back Squat weight'));
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('commits a typed value on blur, snapped to a 5kg increment', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} increment={5} min={40} onChange={onChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, '102');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('commits a typed value snapped to a 1.25kg increment', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} increment={1.25} min={20} onChange={onChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, '48.7');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith(48.75);
  });

  it('accepts a comma decimal', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} onChange={onChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, '62,5');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith(62.5);
  });

  it('commits on Enter', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} onChange={onChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, '65{Enter}');
    expect(onChange).toHaveBeenCalledWith(65);
  });

  it('reverts on Escape without committing', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} onChange={onChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, '65{Escape}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
  });

  it('reverts an unparseable value on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} onChange={onChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, 'abc');
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('60')).toBeInTheDocument();
  });

  it('clamps a typed value below the floor', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} onChange={onChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, '5');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('steps from the typed draft rather than the last committed value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightInput {...defaultProps} onChange={onChange} />);
    const input = screen.getByDisplayValue('60');
    await user.clear(input);
    await user.type(input, '70');
    await user.click(screen.getByLabelText('Increase Back Squat weight'));
    expect(onChange).toHaveBeenCalledWith(72.5);
  });

  it('has an accessible label naming the exercise', () => {
    render(<WeightInput {...defaultProps} />);
    expect(screen.getByLabelText('Back Squat weight in kilograms')).toBeInTheDocument();
  });
});
