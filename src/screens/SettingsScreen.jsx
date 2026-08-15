import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import { DownloadSimple, UploadSimple, FileCsv, ArrowsClockwise, CaretDown } from '@phosphor-icons/react';
import Switch from '../components/Switch';
import Segmented from '../components/Segmented';
import CustomRestSheet from '../components/modals/CustomRestSheet';
import { formatBytes, countSessionsSince, formatClock } from '../utils';
import { REST_PRESETS } from '../constants';

const SectionHeader = ({ children }) => (
  <p className="font-mono text-kicker font-bold uppercase tracking-[0.14em] text-accent-300 mb-3">{children}</p>
);

// Connection state is carried by dot shape, not hue: filled = connected, hollow = never
// connected, dashed = was connected but the token has lapsed.
const DriveDot = ({ state }) => (
  <span className={
    state === 'connected' ? 'w-2 h-2 rounded-full bg-accent shrink-0'
      : state === 'expired' ? 'w-2 h-2 rounded-full border border-dashed border-ink/50 shrink-0'
        : 'w-2 h-2 rounded-full border border-ink/50 shrink-0'
  } />
);

const SettingsScreen = ({
  preferredRest, setPreferredRest, soundEnabled, setSoundEnabled, vibrationEnabled, setVibrationEnabled,
  restWarningEnabled, setRestWarningEnabled,
  isDark, setIsDark, localBackup, setLocalBackup, driveConfigured, gdrive,
  handleConnect, handleDriveSave, formatLastSaved, exportData, fileInputRef, csvInputRef,
  history, backupSizeBytes,
}) => {
  const { t } = useTranslation();
  const mutedClass = 'text-ink/62';
  const rowClass = 'flex items-center justify-between py-4 rule-fade';
  const lastRowClass = 'flex items-center justify-between py-4';

  // Design 3b: custom rest opens a bottom sheet rather than expanding the row in place
  // -- "the list never moves." isCustomActive tracks whether the current value is a
  // custom one (so the chip shows that value instead of the word "Custom") independent
  // of whether the sheet happens to be open right now.
  const [customSheetOpen, setCustomSheetOpen] = useState(false);
  const isCustomActive = !REST_PRESETS.includes(preferredRest);

  // The sheet renders as a sibling of, not inside, the space-y-8 column: that utility
  // puts a margin-top on every child after the first, which would shove a
  // position:fixed/inset-0 sheet down from the viewport edge and leave its backdrop
  // short at the bottom.
  return (
    <>
    <div className="space-y-8">
      <h2 className="font-display text-title font-semibold tracking-[-0.025em]">{t('options.title')}</h2>

      {/* Session */}
      <div>
        <SectionHeader>{t('options.sessionSection')}</SectionHeader>
        <div className="py-4 rule-fade">
          <div className="mb-3">
            <p className="text-card font-semibold">{t('options.restInterval')}</p>
            <p className={`text-meta leading-tight ${mutedClass}`}>{t('options.restIntervalDesc')}</p>
          </div>
          <Segmented
            options={[
              { label: '1:30', val: 90 }, { label: '3:00', val: 180 }, { label: '5:00', val: 300 },
              {
                // Once a custom value is set, the chip carries it (clock-formatted, like
                // the presets) instead of the word "Custom" -- the row still answers "how
                // long is my rest?" at a glance. The chevron is what teaches that it opens
                // something rather than selecting in place.
                label: (
                  <span className="inline-flex items-center gap-[5px]">
                    {isCustomActive ? formatClock(preferredRest * 1000) : t('options.restIntervalCustom')}
                    <CaretDown size={10} weight="bold" />
                  </span>
                ),
                val: 'custom',
              },
            ]}
            value={isCustomActive ? 'custom' : preferredRest}
            onChange={(val) => val === 'custom' ? setCustomSheetOpen(true) : setPreferredRest(val)}
          />
        </div>
        <div className={rowClass}>
          <div><p className="text-card font-semibold">{t('options.soundAlert')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.soundAlertDesc')}</p></div>
          <Switch checked={soundEnabled} onChange={() => setSoundEnabled(!soundEnabled)} ariaLabel="Sound alert" />
        </div>
        {/* The warning only ever plays through the chime, so with Sound alert off this
            row can't do anything. It dims and stops taking taps rather than reading as
            on while silent, and says which switch it's waiting on. */}
        <div className={rowClass}>
          <div className={soundEnabled ? '' : 'opacity-35'}>
            <p className="text-card font-semibold">{t('options.restWarning')}</p>
            <p className={`text-meta leading-tight ${mutedClass}`}>
              {soundEnabled ? t('options.restWarningDesc') : t('options.restWarningNeedsSound')}
            </p>
          </div>
          <Switch
            checked={restWarningEnabled}
            onChange={() => setRestWarningEnabled(!restWarningEnabled)}
            ariaLabel="Five-second warning"
            disabled={!soundEnabled}
          />
        </div>
        <div className={lastRowClass}>
          <div><p className="text-card font-semibold">{t('options.vibration')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.vibrationDesc')}</p></div>
          <Switch checked={vibrationEnabled} onChange={() => setVibrationEnabled(!vibrationEnabled)} ariaLabel="Vibration" />
        </div>
      </div>

      {/* Appearance */}
      <div>
        <SectionHeader>{t('options.appearanceSection')}</SectionHeader>
        <div className={rowClass}>
          <div><p className="text-card font-semibold">{t('options.darkMode')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.darkModeDesc')}</p></div>
          <div className="w-32">
            <Segmented
              options={[{ label: t('options.dark'), val: true }, { label: t('options.light'), val: false }]}
              value={isDark}
              onChange={setIsDark}
              variant="medium"
            />
          </div>
        </div>
        <div className={lastRowClass}>
          <div><p className="text-card font-semibold">{t('options.language')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.languageDesc')}</p></div>
          <div className="w-24">
            <Segmented
              options={[{ label: 'EN', val: 'en' }, { label: 'FR', val: 'fr' }]}
              value={i18n.language?.startsWith('fr') ? 'fr' : 'en'}
              onChange={(code) => i18n.changeLanguage(code)}
            />
          </div>
        </div>
      </div>

      {/* Your data */}
      <div>
        <SectionHeader>{t('options.yourDataSection')}</SectionHeader>
        <div className="p-4 rounded-[10px] border bg-surface border-ink/14">
          {driveConfigured && (() => {
            const driveState = gdrive.isConnected ? 'connected' : gdrive.hasEverConnected ? 'expired' : 'notConnected';
            const unsavedCount = countSessionsSince(history, gdrive.lastSavedAt);
            const statusLabel = driveState === 'connected' ? t('options.driveConnectedLabel') : driveState === 'expired' ? t('options.driveExpiredLabel') : t('options.driveNotConnectedLabel');
            return (
              <>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-[17px] font-semibold truncate">{t('options.googleDrive')}</p>
                  <span className={`flex items-center gap-1.5 shrink-0 text-meta font-medium ${driveState === 'connected' ? 'text-accent-300' : mutedClass}`}>
                    <DriveDot state={driveState} /> {statusLabel}
                  </span>
                </div>
                <div className="mb-3 space-y-0.5">
                  {driveState === 'connected' && (
                    gdrive.saveFailed ? (
                      <button onClick={handleDriveSave} className={`text-meta text-left active:scale-95 ${mutedClass}`}>{t('options.saveFailed')}</button>
                    ) : (
                      <p className={`text-meta leading-tight ${mutedClass}`}>{gdrive.lastSavedAt ? t('options.lastSaved', { time: formatLastSaved(gdrive.lastSavedAt) }) : t('options.savesAfterWorkout')}</p>
                    )
                  )}
                  {driveState === 'expired' && (
                    <>
                      <p className={`text-meta leading-tight ${mutedClass}`}>{t('options.driveExpired')}</p>
                      {gdrive.lastSavedAt && <p className={`text-meta leading-tight ${mutedClass}`}>{t('options.lastSaved', { time: formatLastSaved(gdrive.lastSavedAt) })}</p>}
                      {unsavedCount > 0 && <p className={`text-meta leading-tight ${mutedClass}`}>{t('options.sessionsUnsavedSince', { count: unsavedCount })}</p>}
                    </>
                  )}
                  {driveState === 'notConnected' && (
                    <p className={`text-meta leading-tight ${mutedClass}`}>{t('options.driveOfflineNote')}</p>
                  )}
                </div>
                <button
                  onClick={driveState === 'connected' ? handleDriveSave : handleConnect}
                  disabled={driveState === 'connected' && gdrive.isLoading}
                  className="w-full h-11 rounded-lg border border-accent text-accent-300 font-medium flex items-center justify-center gap-2 active:scale-95 disabled:opacity-35"
                >
                  <ArrowsClockwise size={16} /> {driveState === 'connected' ? t('options.syncNow') : driveState === 'expired' ? t('options.reconnectDrive') : t('options.connectDrive')}
                </button>
                <div className="my-4 border-t border-ink/14" />
              </>
            );
          })()}
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-card font-semibold">{t('options.localBackup')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.localBackupDesc')}</p></div>
            <Switch checked={localBackup} onChange={() => setLocalBackup(!localBackup)} ariaLabel="Local backup" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <button onClick={() => exportData()} className="py-3.5 rounded-lg border border-accent text-accent-300 flex flex-col items-center gap-2 text-meta uppercase active:scale-95 transition-transform">
            <DownloadSimple size={20} /> {t('options.backupToDevice')}
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="py-3.5 rounded-lg border flex flex-col items-center gap-2 text-meta uppercase active:scale-95 transition-transform border-ink/26 text-ink">
            <UploadSimple size={20} /> {t('options.restore')}
          </button>
          <button onClick={() => csvInputRef.current?.click()} aria-label={t('options.importStronglifts')} className="py-3.5 rounded-lg border flex flex-col items-center gap-2 text-meta uppercase active:scale-95 transition-transform border-ink/26 text-ink">
            <FileCsv size={20} /> {t('options.importCsv')}
          </button>
        </div>
      </div>

      {/* About */}
      <div>
        <SectionHeader>{t('options.aboutSection')}</SectionHeader>
        <div className={lastRowClass}>
          <div>
            <p className="text-card font-semibold">{t('app.title')}</p>
            <p className={`text-meta leading-tight mt-0.5 ${mutedClass}`}>{t('options.aboutPrivacy')}</p>
            <p className={`text-meta leading-tight mt-2 ${mutedClass}`}>{t('options.aboutDataSize', { size: formatBytes(backupSizeBytes) })}</p>
          </div>
        </div>
      </div>
    </div>
    {customSheetOpen && (
      <CustomRestSheet
        preferredRest={preferredRest}
        setPreferredRest={setPreferredRest}
        onClose={() => setCustomSheetOpen(false)}
      />
    )}
    </>
  );
};

export default SettingsScreen;
