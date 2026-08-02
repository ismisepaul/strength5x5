import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { calculatePlates } from '../utils';

const PLATE_HEIGHTS = { 25: 124, 20: 112, 15: 100, 10: 88, 5: 70, 2.5: 56, 1.25: 44 };

const BarSetupDiagram = ({ weight, isDark }) => {
  const { t } = useTranslation();
  const plates = useMemo(() => calculatePlates(weight), [weight]);

  return (
    <>
      <div className="flex items-center justify-center gap-1">
        <div className="w-[30px] h-[11px] bg-neutral-tint rounded-l-[3px]" />
        <div className="w-[9px] h-[46px] bg-neutral-tint rounded-[3px]" />
        {plates.map((p, i) => (
          <div
            key={i}
            style={{ height: PLATE_HEIGHTS[p] ?? 44 }}
            className={`w-[26px] rounded-[6px] flex items-center justify-center text-[12px] font-semibold tabular-nums ${i === 0 ? 'bg-accent text-ground' : 'bg-neutral-tint text-ink'}`}
          >{p}</div>
        ))}
        <div className="h-[11px] rounded-r-[3px] bg-neutral-tint flex items-center px-[10px] text-[12px] font-semibold tabular-nums text-ink">20</div>
      </div>
      <p className={`text-center text-[11px] mt-3 ${isDark ? 'text-ink/40' : 'text-ink-lt/40'}`}>
        {weight <= 20 ? t('warmup.emptyBarCaption') : t('warmup.perSideCaption', { total: weight })}
      </p>
    </>
  );
};

export default BarSetupDiagram;
