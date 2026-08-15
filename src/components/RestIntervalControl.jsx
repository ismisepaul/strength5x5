import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, Warning } from '@phosphor-icons/react';
import StepperButton from './StepperButton';
import { formatClock, restBand } from '../utils';
import { CUSTOM_REST_MIN, CUSTOM_REST_MAX, CUSTOM_REST_STEP, REST_PRESETS, REST_SHORT_SECONDS } from '../constants';

const BAND_LABEL_KEYS = {
  light: 'options.restIntervalBandLight',
  medium: 'options.restIntervalBandMedium',
  heavy: 'options.restIntervalBandHeavy',
};

// Design 3c (no custom mode, no sheet) plus design 4a's live feedback layered on top:
// - `notice` mirrors 4a's msgD -- 'cap' when + is pressed while already at
//   CUSTOM_REST_MAX, 'short' whenever a step or preset lands below REST_SHORT_SECONDS.
//   Either clears the moment a different interaction stops matching its condition, so
//   neither ever sits there as a permanent caption.
// - `band` is not sticky like `notice` -- it's just restBand(preferredRest), recomputed
//   every render, so "Typical for: Medium Set" tracks the live value even while a cap or
//   short notice is also showing.
const RestIntervalControl = ({ preferredRest, setPreferredRest }) => {
  const { t } = useTranslation();
  const clamp = (n) => Math.min(CUSTOM_REST_MAX, Math.max(CUSTOM_REST_MIN, n));
  const fillPct = ((preferredRest - CUSTOM_REST_MIN) / (CUSTOM_REST_MAX - CUSTOM_REST_MIN)) * 100;
  const band = restBand(preferredRest);

  const [notice, setNotice] = useState(null); // 'cap' | 'short' | null
  const step = (diff) => {
    if (diff > 0 && preferredRest >= CUSTOM_REST_MAX) {
      setNotice('cap');
      setPreferredRest(CUSTOM_REST_MAX);
      return;
    }
    // CUSTOM_REST_MIN (5) sits below the step grid on purpose (see constants.js), so
    // landing on it and then pressing + would otherwise add the step from 5 (5, 15,
    // 25...) rather than rejoining the grid the rest of the range steps on (10, 20...).
    const offGrid = preferredRest % CUSTOM_REST_STEP !== 0;
    const next = diff > 0 && offGrid
      ? clamp(preferredRest + (CUSTOM_REST_STEP - (preferredRest % CUSTOM_REST_STEP)))
      : clamp(preferredRest + diff);
    setNotice(next < REST_SHORT_SECONDS ? 'short' : null);
    setPreferredRest(next);
  };
  const jumpTo = (secs) => {
    setNotice(secs < REST_SHORT_SECONDS ? 'short' : null);
    setPreferredRest(secs);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div>
          <p className="text-card font-semibold">{t('options.restInterval')}</p>
          <p className="text-meta leading-tight text-ink/62">{t('options.restIntervalDesc')}</p>
        </div>
        <span className="font-mono text-[26px] font-bold leading-none tabular-nums text-accent-300 shrink-0">
          {formatClock(preferredRest * 1000)}
        </span>
      </div>
      <div className="flex items-center gap-2.5 mb-3">
        <StepperButton
          onClick={() => step(-CUSTOM_REST_STEP)}
          ariaLabel={t('options.restIntervalDecreaseAria')}
          icon={Minus}
          size={44}
          iconSize={16}
          dimmed={preferredRest <= CUSTOM_REST_MIN}
        />
        <div className="relative flex-1 h-11 rounded-lg bg-ink/7 overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-accent-900 border-r border-accent" style={{ width: `${fillPct}%` }} />
          <div className="absolute inset-0 flex items-center justify-center text-[11.5px] text-ink/45">
            {t('options.restIntervalStepHint', { step: CUSTOM_REST_STEP, max: formatClock(CUSTOM_REST_MAX * 1000) })}
          </div>
        </div>
        <StepperButton
          onClick={() => step(CUSTOM_REST_STEP)}
          ariaLabel={t('options.restIntervalIncreaseAria')}
          icon={Plus}
          size={44}
          iconSize={16}
          dimmed={preferredRest >= CUSTOM_REST_MAX}
        />
      </div>
      <div className="flex gap-2">
        {REST_PRESETS.map((secs) => (
          <button
            key={secs}
            onClick={() => jumpTo(secs)}
            className={`flex-1 h-9 rounded-lg border font-mono text-[13px] tabular-nums ${
              preferredRest === secs ? 'border-accent bg-accent-900 text-accent-300' : 'border-ink/18 text-ink/62'
            }`}
          >{formatClock(secs * 1000)}</button>
        ))}
      </div>
      {band && (
        <p className="mt-2.5 font-mono text-kicker font-bold uppercase tracking-[0.12em] text-ink/50">
          {t('options.restIntervalBandPrefix')} <span className="text-accent-300">{t(BAND_LABEL_KEYS[band])}</span>
        </p>
      )}
      {notice && (
        <div className="mt-3 pl-[11px] border-l-2 border-accent flex gap-[7px] items-start">
          <Warning size={14} weight="bold" className="text-accent-300 shrink-0 mt-0.5" />
          <p className="text-[12px] leading-[1.55] text-ink/62">
            {t(notice === 'cap' ? 'options.restIntervalCapExplainer' : 'options.restIntervalShortWarning')}
          </p>
        </div>
      )}
    </div>
  );
};

export default RestIntervalControl;
