import React from 'react';

const VARIANT_TEXT = {
  uppercase: 'text-meta uppercase tracking-wide',
  medium: 'text-[13px] font-medium',
};

// Two visual variants exist because the app has never settled on one: Settings and
// the Log's date-range control use an uppercase meta label, the Program tab uses
// medium-weight body text. Preserved as-is (each call site keeps its exact prior
// appearance) pending an owner decision on which should win -- see
// docs/refactor-plan.md Phase 5.
const Segmented = ({ options, value, onChange, variant = 'uppercase' }) => {
  const mutedClass = 'text-ink/45';
  return (
    <div className="flex rounded-lg border overflow-hidden border-ink/10">
      {options.map((opt, i) => (
        <button
          key={opt.val}
          onClick={() => onChange(opt.val)}
          className={`flex-1 py-3 ${VARIANT_TEXT[variant]} transition-all ${i > 0 ? 'border-l border-ink/10' : ''} ${value === opt.val ? 'bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_var(--color-accent)]' : mutedClass}`}
        >{opt.label}</button>
      ))}
    </div>
  );
};

export default Segmented;
