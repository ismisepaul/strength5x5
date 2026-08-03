import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { calculatePlates } from '../utils';

// Standard plate colours, muted for the dark UI. Scoped to this diagram only —
// the rest of the app stays mono-accent.
const PLATE_STYLES = {
  25:   { height: 118, bg: '#a8403e', text: '#e9e9ed' },
  20:   { height: 112, bg: '#37628f', text: '#e9e9ed' },
  15:   { height: 100, bg: '#b8971f', text: '#1a1608' },
  10:   { height: 88,  bg: '#3a7a53', text: '#e9e9ed' },
  5:    { height: 70,  bg: '#2a2c38', text: '#e9e9ed' },
  2.5:  { height: 56,  bg: '#5f636f', text: '#e9e9ed' },
  1.25: { height: 44,  bg: '#7c8090', text: '#e9e9ed' },
};

const BarSetupDiagram = ({ weight }) => {
  const { t } = useTranslation();
  const plates = useMemo(() => calculatePlates(weight), [weight]);

  return (
    <>
      <div className="flex items-center justify-center gap-1">
        <div className="w-[30px] h-[11px] bg-neutral-tint rounded-l-[3px]" />
        <div className="w-[9px] h-[46px] bg-neutral-tint rounded-[3px]" />
        {plates.map((p, i) => {
          const style = PLATE_STYLES[p] ?? PLATE_STYLES[1.25];
          return (
            <div
              key={i}
              style={{ height: style.height, backgroundColor: style.bg, color: style.text }}
              className="w-[26px] rounded-[6px] flex items-center justify-center text-[12px] font-semibold tabular-nums"
            >{p}</div>
          );
        })}
        <div className="h-[11px] rounded-r-[3px] bg-neutral-tint flex items-center px-[10px] text-[12px] font-semibold tabular-nums text-ink">20</div>
      </div>
      <p className={`text-center text-[11px] mt-3 text-ink/40`}>
        {weight <= 20 ? t('warmup.emptyBarCaption') : t('warmup.perSideCaption', { total: weight })}
      </p>
    </>
  );
};

export default BarSetupDiagram;
