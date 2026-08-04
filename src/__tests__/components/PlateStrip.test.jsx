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

  it('renders nothing for an empty bar', () => {
    const { container } = render(<PlateStrip weight={20} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is decorative and hidden from the accessibility tree', () => {
    const { container } = render(<PlateStrip weight={100} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
