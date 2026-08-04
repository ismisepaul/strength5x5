import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import PlateStrip from '../../components/PlateStrip';

describe('PlateStrip', () => {
  it('renders one scaled bar per plate, largest first', () => {
    const { container } = render(<PlateStrip weight={60} />);
    const bars = container.querySelectorAll('[aria-hidden="true"] > div');

    // 60kg -> 20 per side -> one 20kg plate
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveStyle({ backgroundColor: '#37628f', height: '19px' });
  });

  it('reserves its height for an empty bar instead of collapsing', () => {
    const { container } = render(<PlateStrip weight={20} />);
    const strip = container.querySelector('[aria-hidden="true"]');
    expect(strip).toBeInTheDocument();
    expect(strip.children).toHaveLength(0);
    expect(strip.className).toContain('h-5');
  });

  it('is decorative and hidden from the accessibility tree', () => {
    const { container } = render(<PlateStrip weight={100} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
