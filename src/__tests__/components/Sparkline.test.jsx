import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Sparkline from '../../components/Sparkline';

describe('Sparkline', () => {
  it('renders nothing with fewer than two values', () => {
    const { container: empty } = render(<Sparkline values={[]} />);
    expect(empty.querySelector('svg')).not.toBeInTheDocument();

    const { container: single } = render(<Sparkline values={[50]} />);
    expect(single.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders a polyline with one point per value', () => {
    const { container } = render(<Sparkline values={[50, 52.5, 50, 55]} />);
    const polyline = container.querySelector('polyline');

    expect(polyline).toBeInTheDocument();
    expect(polyline.getAttribute('points').trim().split(' ')).toHaveLength(4);
  });

  it('draws a flat horizontal line when every value is identical', () => {
    const { container } = render(<Sparkline values={[50, 50, 50]} width={60} height={20} />);
    const points = container.querySelector('polyline').getAttribute('points').trim().split(' ');
    const ys = points.map(p => p.split(',')[1]);

    expect(new Set(ys).size).toBe(1);
  });

  it('is hidden from assistive tech since the value is always shown as text nearby', () => {
    const { container } = render(<Sparkline values={[50, 55]} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
