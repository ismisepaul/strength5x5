import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import { DownloadSimple, UploadSimple, FileCsv } from '@phosphor-icons/react';
import Switch from '../components/Switch';
import Segmented from '../components/Segmented';
import { formatBytes, countSessionsSince } from '../utils';

const SectionHeader = ({ children }) => (
  <p className="text-kicker font-semibold uppercase tracking-[0.14em] text-accent-300 mb-3">{children}</p>
);

// Connection state is carried by dot shape, not hue: filled = connected, hollow = never
// connected, dashed = was connected but the token has lapsed.
const DriveDot = ({ state }) => (
  <span className={
    state === 'connected' ? 'w-2 h-2 rounded-full bg-accent shrink-0'
      : state === 'expired' ? 'w-2 h-2 rounded-full border border-dashed border-ink/50 shrink-0'
        : 'w-2 h-2 rounded-full border border-ink/40 shrink-0'
  } />
);

const SettingsScreen = ({
  preferredRest, setPreferredRest, soundEnabled, setSoundEnabled, vibrationEnabled, setVibrationEnabled,
  isDark, setIsDark, localBackup, setLocalBackup, driveConfigured, gdrive,
  handleConnect, handleDriveSave, formatLastSaved, exportData, fileInputRef, csvInputRef,
  history, backupSizeBytes,
}) => {
  const { t } = useTranslation();
  const mutedClass = 'text-ink/62';
  const rowClass = 'flex items-center justify-between py-4 rule-fade';
  const lastRowClass = 'flex items-center justify-between py-4';

  return (
    <div className="space-y-8">
      <h2 className="text-title font-medium">{t('options.title')}</h2>

      {/* Session */}
      <div>
        <SectionHeader>{t('options.sessionSection')}</SectionHeader>
        <div className="py-4 rule-fade">
          <div className="mb-3">
            <p className="text-card font-semibold">{t('options.restInterval')}</p>
            <p className={`text-meta leading-tight ${mutedClass}`}>{t('options.restIntervalDesc')}</p>
          </div>
          <Segmented
            options={[{ label: '1:30', val: 90 }, { label: '3:00', val: 180 }, { label: '5:00', val: 300 }]}
            value={preferredRest}
            onChange={setPreferredRest}
          />
        </div>
        <div className={rowClass}>
          <div><p className="text-card font-semibold">{t('options.soundAlert')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.soundAlertDesc')}</p></div>
          <Switch checked={soundEnabled} onChange={() => setSoundEnabled(!soundEnabled)} ariaLabel="Sound alert" />
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
        <div className={rowClass}>
          <div><p className="text-body font-medium">{t('options.localBackup')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.localBackupDesc')}</p></div>
          <Switch checked={localBackup} onChange={() => setLocalBackup(!localBackup)} ariaLabel="Local backup" />
        </div>

        {driveConfigured && (() => {
          const driveState = gdrive.isConnected ? 'connected' : gdrive.hasEverConnected ? 'expired' : 'notConnected';
          const unsavedCount = countSessionsSince(history, gdrive.lastSavedAt);
          return (
            <div className={rowClass}>
              <div className="w-full">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <DriveDot state={driveState} />
                    <p className="text-body font-medium truncate">{t('options.googleDrive')}</p>
                  </div>
                  {driveState === 'connected' ? (
                    <button onClick={handleDriveSave} disabled={gdrive.isLoading} className="text-meta uppercase px-3.5 py-2.5 rounded-lg border active:scale-95 disabled:opacity-35 border-ink/26 text-ink shrink-0">{t('options.syncNow')}</button>
                  ) : (
                    <button onClick={handleConnect} className="text-meta uppercase px-3.5 py-2.5 rounded-lg border active:scale-95 border-ink/26 text-ink shrink-0">{driveState === 'expired' ? t('options.reconnectDrive') : t('options.connectDrive')}</button>
                  )}
                </div>
                <div className="pl-4 mt-1 space-y-1">
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
              </div>
            </div>
          );
        })()}

        <div className={lastRowClass}>
          <div className="grid grid-cols-3 gap-2 w-full">
            <button onClick={() => exportData()} className="py-3.5 rounded-lg border border-accent text-accent flex flex-col items-center gap-2 text-meta uppercase active:scale-95 transition-transform">
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
  );
};

export default SettingsScreen;
