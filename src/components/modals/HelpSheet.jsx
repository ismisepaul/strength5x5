import React from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, Moon, Cloud, Barbell, CaretRight } from '@phosphor-icons/react';
import { getProgram } from '../../programs';
import Sheet from './Sheet';
import { Z_TOP } from './zIndex';

const HelpSheet = ({ preset, onOpenProgram, onClose }) => {
  const { t } = useTranslation();
  return (
    <Sheet ariaLabel="How it works" z={Z_TOP} onClose={onClose}>
      <h3 className="text-lg font-semibold mb-5">{t('help.title')}</h3>
      <div className="max-h-[60vh] overflow-y-auto overscroll-contain space-y-5 mb-6 text-left">
        {[
          { Icon: Timer, title: t('help.restTitle'), body: t('help.restBody') },
          { Icon: Moon, title: t('help.longBreaksTitle'), body: t('help.longBreaksBody') },
          { Icon: Cloud, title: t('help.backupsTitle'), body: t('help.backupsBody') },
        ].map(({ Icon, title, body }) => (
          <div key={title} className="flex items-start gap-3">
            <div className="w-[30px] h-[30px] rounded-lg border border-accent text-accent flex items-center justify-center shrink-0"><Icon size={18} /></div>
            <div><p className="text-card font-medium">{title}</p><p className="text-body leading-relaxed text-ink/55">{body}</p></div>
          </div>
        ))}
      </div>
      <button
        onClick={onOpenProgram}
        className="w-full flex items-center justify-between p-4 rounded-[10px] border mb-3 active:scale-[0.99] transition-transform bg-surface-deep border-ink/8"
      >
        <span className="flex items-center gap-2 text-[14.5px] font-medium">
          <Barbell weight="fill" size={17} className="text-accent" /> {t('help.programLink')}
        </span>
        <span className="flex items-center gap-1 text-body text-accent-300 shrink-0">
          {t(getProgram(preset).nameKey)} <CaretRight size={14} />
        </span>
      </button>
      <button autoFocus onClick={onClose} className="w-full h-[46px] flex items-center justify-center rounded-lg border text-[14px] font-medium active:scale-95 border-ink/18 text-ink">{t('help.gotIt')}</button>
    </Sheet>
  );
};

export default HelpSheet;
