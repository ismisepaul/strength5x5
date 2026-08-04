import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HelpSheet from '../../components/modals/HelpSheet';

const renderSheet = (props = {}) =>
  render(<HelpSheet preset="standard" onOpenProgram={vi.fn()} onClose={vi.fn()} {...props} />);

describe('HelpSheet', () => {
  it('explains what 5x5 is before any app mechanics', () => {
    const { container } = renderSheet();
    // Anchored to the title elements rather than a text match, because a body line can
    // legitimately repeat its own title ("Five sets of five reps is the backbone...").
    const titles = [...container.querySelectorAll('p.text-card')].map((el) => el.textContent);
    expect(titles).toEqual([
      'Compound barbell exercises',
      'Five sets of five',
      'Three times a week',
      'Start light',
      'Add weight gradually',
      'Rest',
      'Long breaks',
      'Choose your program',
      'Backups',
    ]);
  });

  it('gives the light start a recovery rationale rather than a progression one', () => {
    renderSheet();
    expect(screen.getByText('Less soreness, and your body adapts to the movements.')).toBeInTheDocument();
  });

  it('keeps user-facing copy free of em dashes', () => {
    renderSheet();
    expect(screen.getByRole('dialog').textContent).not.toMatch(/—/);
  });

  it('labels the dialog with the translated title', () => {
    renderSheet();
    expect(screen.getByRole('dialog', { name: 'How it works' })).toBeInTheDocument();
  });

  it('names the active program on the link and opens it when tapped', async () => {
    const onOpenProgram = vi.fn();
    const user = userEvent.setup();
    renderSheet({ preset: 'madcow', onOpenProgram });
    expect(screen.getByText('Madcow 5×5')).toBeInTheDocument();
    await user.click(screen.getByText('Sets, reps and progression'));
    expect(onOpenProgram).toHaveBeenCalledTimes(1);
  });

  it('closes on the Got it button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderSheet({ onClose });
    await user.click(screen.getByText('Got it'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
