import React from 'react';
import { useTranslation } from 'react-i18next';

// The week's 3-session goal as three dots -- banked sessions filled, owed ones hollow.
// Shared by Train's verdict line and Log's week card so "one banked, two owed" always
// looks like the same fact wherever it shows up.
const WeekPips = ({ done, goal = 3, className = '' }) => {
  const { t } = useTranslation();
  return (
    <span aria-label={t('workout.weekPipsAria', { done, goal })} className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: goal }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`w-[7px] h-[7px] rounded-full ${i < done ? 'bg-accent' : 'border-[1.5px] border-accent'}`}
        />
      ))}
    </span>
  );
};

export default WeekPips;
