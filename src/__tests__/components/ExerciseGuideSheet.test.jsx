import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseGuideSheet from '../../components/ExerciseGuideSheet';

describe('ExerciseGuideSheet', () => {
  it('renders the exercise name as the heading and lists its numbered steps', () => {
    render(<ExerciseGuideSheet liftId="squat" isDark={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'How to perform Back Squat' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Back Squat')).toBeInTheDocument();
    expect(screen.getByText('Place bar on upper back (traps) and unrack.')).toBeInTheDocument();
    expect(screen.getByText('Lock hips and knees at top. Rack bar safely.')).toBeInTheDocument();
  });

  it('renders a distinct set of steps per lift', () => {
    render(<ExerciseGuideSheet liftId="incline" isDark={true} onClose={vi.fn()} />);
    expect(screen.getByText('Set bench to 30° angle and lie down with eyes under bar.')).toBeInTheDocument();
    expect(screen.queryByText('Place bar on upper back (traps) and unrack.')).not.toBeInTheDocument();
  });

  it('calls onClose when the backdrop or Close button is tapped', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseGuideSheet liftId="squat" isDark={true} onClose={onClose} />);
    await user.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the sheet body itself is tapped', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ExerciseGuideSheet liftId="squat" isDark={true} onClose={onClose} />);
    await user.click(screen.getByText('Back Squat'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
