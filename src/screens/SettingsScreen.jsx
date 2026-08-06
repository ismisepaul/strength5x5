import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import { DownloadSimple, UploadSimple, FileCsv } from '@phosphor-icons/react';
import Switch from '../components/Switch';
import Segmented from '../components/Segmented';

const SettingsScreen = ({
  preferredRest, setPreferredRest, soundEnabled, setSoundEnabled, vibrationEnabled, setVibrationEnabled,
  isDark, setIsDark, localBackup, setLocalBackup, driveConfigured, gdrive,
  handleConnect, handleDriveSave, formatLastSaved, exportData, fileInputRef, csvInputRef,
}) => {
  const { t } = useTranslation();
  const mutedClass = 'text-ink/62';
  const cardClass = 'p-4 rounded-[10px] border bg-surface border-ink/8';
  const innerRowClass = 'rule-fade';

  return (
    <div className="space-y-6">
      <h2 className="text-title font-medium mb-6">{t('options.title')}</h2>
      <div className={cardClass}>
        <div className="mb-4">
          <p className="text-card font-semibold">{t('options.restInterval')}</p>
          <p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.restIntervalDesc')}</p>
        </div>
        <Segmented
          options={[{ label: '1:30', val: 90 }, { label: '3:00', val: 180 }, { label: '5:00', val: 300 }]}
          value={preferredRest}
          onChange={setPreferredRest}
        />
      </div>

      <div className={cardClass}>
        <div className={`flex items-center justify-between pb-4 mb-4 ${innerRowClass}`}>
          <div><p className="text-card font-semibold">{t('options.soundAlert')}</p><p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.soundAlertDesc')}</p></div>
          <Switch checked={soundEnabled} onChange={() => setSoundEnabled(!soundEnabled)} ariaLabel="Sound alert" />
        </div>
        <div className="flex items-center justify-between">
          <div><p className="text-card font-semibold">{t('options.vibration')}</p><p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.vibrationDesc')}</p></div>
          <Switch checked={vibrationEnabled} onChange={() => setVibrationEnabled(!vibrationEnabled)} ariaLabel="Vibration" />
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div><p className="text-card font-semibold">{t('options.darkMode')}</p><p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.darkModeDesc')}</p></div>
          <Switch checked={isDark} onChange={() => setIsDark(!isDark)} ariaLabel="Dark mode" />
        </div>
      </div>

      {/* Backup & Sync */}
      <div className={cardClass}>
        <div className={`pb-4 mb-4 ${innerRowClass}`}>
          <p className="text-card font-semibold">{t('options.backupSync')}</p>
          <p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.backupSyncDesc')}</p>
        </div>

        {/* Local Backup toggle */}
        <div className={`flex items-center justify-between pb-4 mb-4 ${innerRowClass}`}>
          <div><p className="text-body font-medium">{t('options.localBackup')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.localBackupDesc')}</p></div>
          <Switch checked={localBackup} onChange={() => setLocalBackup(!localBackup)} ariaLabel="Local backup" />
        </div>

        {/* Google Drive section */}
        {driveConfigured && (
          <div className={`pb-4 mb-4 ${innerRowClass}`}>
            <div className="flex items-center justify-between mb-2">
              <div><p className="text-body font-medium">{t('options.googleDrive')}</p><p className={`text-meta leading-tight ${mutedClass}`}>{t('options.googleDriveDesc')}</p></div>
              {gdrive.isConnected ? (
                <span className="text-meta uppercase px-2.5 py-1.5 rounded-lg text-accent-300 bg-accent-900">{t('options.connectedToDrive')}</span>
              ) : (
                <button onClick={handleConnect} className="text-meta uppercase px-3.5 py-2.5 rounded-lg border active:scale-95 border-ink/18 text-ink">{gdrive.hasEverConnected ? t('options.reconnectDrive') : t('options.connectDrive')}</button>
              )}
            </div>
            {(gdrive.isConnected || gdrive.hasEverConnected) && (
              <div className="mt-3 space-y-2">
                <p className={`text-meta leading-tight ${mutedClass}`}>{t('options.savesAfterWorkout')}</p>
                <div className="flex items-center justify-between">
                  {gdrive.saveFailed ? (
                    <button onClick={handleDriveSave} className={`text-meta active:scale-95 ${mutedClass}`}>{t('options.saveFailed')}</button>
                  ) : gdrive.lastSavedAt ? (
                    <p className="text-meta text-accent">{t('options.lastSaved', { time: formatLastSaved(gdrive.lastSavedAt) })}</p>
                  ) : <span />}
                  <button onClick={handleDriveSave} disabled={gdrive.isLoading} className="text-meta uppercase px-3.5 py-2.5 rounded-lg border active:scale-95 disabled:opacity-35 border-ink/18 text-ink">{t('options.syncNow')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Backup & Restore buttons */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button onClick={() => exportData()} className="py-3.5 rounded-lg border border-accent text-accent flex flex-col items-center gap-2 text-meta uppercase active:scale-95 transition-transform">
            <DownloadSimple size={20} /> {t('options.backupToDevice')}
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="py-3.5 rounded-lg border flex flex-col items-center gap-2 text-meta uppercase active:scale-95 transition-transform border-ink/18 text-ink">
            <UploadSimple size={20} /> {t('options.restore')}
          </button>
        </div>
        <button onClick={() => csvInputRef.current?.click()} className="w-full py-3.5 rounded-lg border flex items-center justify-center gap-2 text-meta uppercase active:scale-95 transition-transform border-ink/18 text-ink">
          <FileCsv size={20} /> {t('options.importStronglifts')}
        </button>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div><p className="text-card font-semibold">{t('options.language')}</p><p className={`text-meta uppercase leading-tight ${mutedClass}`}>{t('options.languageDesc')}</p></div>
          <div className="w-24">
            <Segmented
              options={[{ label: 'EN', val: 'en' }, { label: 'FR', val: 'fr' }]}
              value={i18n.language?.startsWith('fr') ? 'fr' : 'en'}
              onChange={(code) => i18n.changeLanguage(code)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
