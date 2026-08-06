import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import { DownloadSimple, UploadSimple, FileCsv } from '@phosphor-icons/react';
import Switch from '../components/Switch';
import Segmented from '../components/Segmented';

const SectionHeader = ({ children }) => (
  <p className="text-kicker font-semibold uppercase tracking-[0.14em] text-accent-300 mb-3">{children}</p>
);

const SettingsScreen = ({
  preferredRest, setPreferredRest, soundEnabled, setSoundEnabled, vibrationEnabled, setVibrationEnabled,
  isDark, setIsDark, localBackup, setLocalBackup, driveConfigured, gdrive,
  handleConnect, handleDriveSave, formatLastSaved, exportData, fileInputRef, csvInputRef,
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

        {driveConfigured && (
          <div className={rowClass}>
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <div><p className="text-body font-medium">{t('options.googleDrive')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.googleDriveDesc')}</p></div>
                {gdrive.isConnected ? (
                  <span className="text-meta uppercase px-2.5 py-1.5 rounded-lg text-accent-300 bg-accent-900">{t('options.connectedToDrive')}</span>
                ) : (
                  <button onClick={handleConnect} className="text-meta uppercase px-3.5 py-2.5 rounded-lg border active:scale-95 border-ink/26 text-ink">{gdrive.hasEverConnected ? t('options.reconnectDrive') : t('options.connectDrive')}</button>
                )}
              </div>
              {(gdrive.isConnected || gdrive.hasEverConnected) && (
                <div className="mt-3 space-y-2">
                  <p className={`text-meta leading-tight ${mutedClass}`}>{t('options.savesAfterWorkout')}</p>
                  <div className="flex items-center justify-between">
                    {gdrive.saveFailed ? (
                      <button onClick={handleDriveSave} className={`text-meta active:scale-95 ${mutedClass}`}>{t('options.saveFailed')}</button>
                    ) : gdrive.lastSavedAt ? (
                      <p className="text-meta text-accent-300">{t('options.lastSaved', { time: formatLastSaved(gdrive.lastSavedAt) })}</p>
                    ) : <span />}
                    <button onClick={handleDriveSave} disabled={gdrive.isLoading} className="text-meta uppercase px-3.5 py-2.5 rounded-lg border active:scale-95 disabled:opacity-35 border-ink/26 text-ink">{t('options.syncNow')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={`${lastRowClass} flex-col items-stretch gap-3`}>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => exportData()} className="py-3.5 rounded-lg border border-accent text-accent flex flex-col items-center gap-2 text-meta uppercase active:scale-95 transition-transform">
              <DownloadSimple size={20} /> {t('options.backupToDevice')}
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="py-3.5 rounded-lg border flex flex-col items-center gap-2 text-meta uppercase active:scale-95 transition-transform border-ink/26 text-ink">
              <UploadSimple size={20} /> {t('options.restore')}
            </button>
          </div>
          <button onClick={() => csvInputRef.current?.click()} className="w-full py-3.5 rounded-lg border flex items-center justify-center gap-2 text-meta uppercase active:scale-95 transition-transform border-ink/26 text-ink">
            <FileCsv size={20} /> {t('options.importStronglifts')}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
