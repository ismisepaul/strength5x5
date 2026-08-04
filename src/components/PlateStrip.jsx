import React, { useMemo } from 'react';
import { calculatePlates } from '../utils';
import { PLATE_STYLES } from '../plateStyles';

// A miniature preview of BarSetupDiagram's plate stack, scaled to sit under an
// exercise name on the Train idle list. Purely decorative -- the weight itself is
// already read out by the WeightInput beside it -- so it's hidden from the a11y tree.
// Always renders its own height, even with an empty bar (no plates), so the row
// beneath it doesn't jump as weight crosses the first-plate threshold.
const PlateStrip = ({ weight }) => {
  const plates = useMemo(() => calculatePlates(weight), [weight]);

  return (
    <div className="flex items-end gap-[3px] h-5 mt-1.5" aria-hidden="true">
      {plates.map((p, i) => {
        const style = PLATE_STYLES[p] ?? PLATE_STYLES[1.25];
        return (
          <div
            key={i}
            style={{ height: `${Math.round(style.height / 6)}px`, backgroundColor: style.bg }}
            className="w-1.5 rounded-sm"
          />
        );
      })}
    </div>
  );
};

export default PlateStrip;
