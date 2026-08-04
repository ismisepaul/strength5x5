import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { calculatePlates } from '../utils';
import { PLATE_STYLES } from '../plateStyles';

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
              className="w-[26px] rounded-[6px] flex items-center justify-center text-meta font-semibold tabular-nums"
            >{p}</div>
          );
        })}
        <div className="h-[11px] rounded-r-[3px] bg-neutral-tint flex items-center px-[10px] text-meta font-semibold tabular-nums text-ink">20</div>
      </div>
      <p className={`text-center text-tab mt-3 text-ink/40`}>
        {weight <= 20 ? t('warmup.emptyBarCaption') : t('warmup.perSideCaption', { total: weight })}
      </p>
    </>
  );
};

export default BarSetupDiagram;
