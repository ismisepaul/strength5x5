import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BarSetupDiagram from '../../components/BarSetupDiagram';

describe('BarSetupDiagram', () => {
  const cases = [
    { weight: 70, label: '25', height: '118px', bg: '#a8403e', color: '#e9e9ed' },
    { weight: 60, label: '20', height: '112px', bg: '#37628f', color: '#e9e9ed' },
    { weight: 50, label: '15', height: '100px', bg: '#b8971f', color: '#1a1608' },
    { weight: 40, label: '10', height: '88px', bg: '#3a7a53', color: '#e9e9ed' },
    { weight: 30, label: '5', height: '70px', bg: '#2a2c38', color: '#e9e9ed' },
    { weight: 25, label: '2.5', height: '56px', bg: '#5f636f', color: '#e9e9ed' },
    { weight: 22.5, label: '1.25', height: '44px', bg: '#7c8090', color: '#e9e9ed' },
  ];

  it.each(cases)('renders the $label kg plate with its scoped colour, height, and label', ({ weight, label, height, bg, color }) => {
    const { container } = render(<BarSetupDiagram weight={weight} />);
    const plate = Array.from(container.querySelectorAll('[style]')).find((node) => node.textContent === label);

    expect(plate).toBeInTheDocument();
    expect(plate).toHaveStyle({ height, backgroundColor: bg, color });
    cleanup();
  });

  it('prints the weight on every repeated plate', () => {
    render(<BarSetupDiagram weight={120} />);

    expect(screen.getAllByText('25')).toHaveLength(2);
    expect(screen.getByText('Per side · 20 kg bar · 120 total')).toBeInTheDocument();
  });
});
