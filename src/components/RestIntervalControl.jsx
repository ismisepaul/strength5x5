import React, { useRef, useState } from 'react';
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

// Design 3c (no custom mode, no sheet) plus design 4a's live feedback layered on top,
// plus design 7b's draggable track: the whole 0:30-5:00 range is one gesture instead of
// 27 taps, snapped to the same 10s grid the steppers use.
// - `notice` mirrors 4a's msgD -- 'cap' when the requested value overshoots
//   CUSTOM_REST_MAX (stepper +, drag past the right edge, or Right/End past the max),
//   'short' whenever the committed value lands below REST_SHORT_SECONDS. Either clears
//   the moment a different interaction stops matching its condition, so neither ever
//   sits there as a permanent caption.
// - `band` is not sticky like `notice` -- it's just restBand(preferredRest), recomputed
//   every render, so "Typical for: Medium Set" tracks the live value even while a cap or
//   short notice is also showing.
const RestIntervalControl = ({ preferredRest, setPreferredRest }) => {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const clamp = (n) => Math.min(CUSTOM_REST_MAX, Math.max(CUSTOM_REST_MIN, n));
  const snap = (n) => Math.round(n / CUSTOM_REST_STEP) * CUSTOM_REST_STEP;
  const fillPct = ((preferredRest - CUSTOM_REST_MIN) / (CUSTOM_REST_MAX - CUSTOM_REST_MIN)) * 100;
  const band = restBand(preferredRest);

  const [notice, setNotice] = useState(null); // 'cap' | 'short' | null
  const [dragging, setDragging] = useState(false);

  // Shared by the steppers, the presets, drag, and the keyboard fallback -- `raw` is
  // allowed to sit outside CUSTOM_REST_MIN..MAX (that's how a drag past either edge, or
  // a stepper press against it, is told apart from one that merely lands on the edge),
  // while the value actually committed is always clamped into range.
  const commit = (raw) => {
    const value = clamp(raw);
    setNotice(raw > CUSTOM_REST_MAX ? 'cap' : value < REST_SHORT_SECONDS ? 'short' : null);
    setPreferredRest(value);
  };
  const step = (diff) => commit(preferredRest + diff);
  const jumpTo = (secs) => commit(secs);

  const valueFromClientX = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return snap(CUSTOM_REST_MIN + ratio * (CUSTOM_REST_MAX - CUSTOM_REST_MIN));
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    commit(valueFromClientX(e.clientX));
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    commit(valueFromClientX(e.clientX));
  };
  const endDrag = (e) => {
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); step(CUSTOM_REST_STEP); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); step(-CUSTOM_REST_STEP); }
    else if (e.key === 'Home') { e.preventDefault(); commit(CUSTOM_REST_MIN); }
    else if (e.key === 'End') { e.preventDefault(); commit(CUSTOM_REST_MAX); }
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
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={t('options.restInterval')}
          aria-valuemin={CUSTOM_REST_MIN}
          aria-valuemax={CUSTOM_REST_MAX}
          aria-valuenow={preferredRest}
          aria-valuetext={formatClock(preferredRest * 1000)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          className="relative flex-1 h-11 rounded-lg bg-ink/7 overflow-hidden cursor-pointer touch-none"
        >
          <div className="absolute inset-y-0 left-0 bg-accent-900" style={{ width: `${fillPct}%` }} />
          <div
            aria-hidden="true"
            className="absolute top-1/2 w-1 h-6 rounded-full bg-accent pointer-events-none"
            style={{ left: `${fillPct}%`, transform: 'translate(-50%, -50%)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[11.5px] text-ink/45 pointer-events-none">
            {t('options.restIntervalDragHint', { min: formatClock(CUSTOM_REST_MIN * 1000), max: formatClock(CUSTOM_REST_MAX * 1000) })}
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
