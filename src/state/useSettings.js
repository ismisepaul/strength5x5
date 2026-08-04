import { useState } from 'react';

// Groups the app-preference fields: all saved.*-seeded, all written in the same
// useSyncStorage call, none read outside the Settings screen and the handful of
// places that need their current value (chime playback, rest timer duration, drive
// echo payloads). Only isDark is cross-tab synced -- see App.jsx's useStorageSync --
// so this hook doesn't need its own hydrate(); that one line stays inline.
export const useSettings = (saved) => {
  const [isDark, setIsDark] = useState(() => saved.isDark ?? window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [localBackup, setLocalBackup] = useState(saved.autoSave ?? false);
  const [preferredRest, setPreferredRest] = useState(saved.preferredRest ?? 90);
  const [soundEnabled, setSoundEnabled] = useState(saved.soundEnabled ?? false);
  const [vibrationEnabled, setVibrationEnabled] = useState(saved.vibrationEnabled ?? saved.hapticsEnabled ?? false);
  const [logGrouping, setLogGrouping] = useState(saved.logGrouping ?? 'all');

  return {
    isDark, setIsDark,
    localBackup, setLocalBackup,
    preferredRest, setPreferredRest,
    soundEnabled, setSoundEnabled,
    vibrationEnabled, setVibrationEnabled,
    logGrouping, setLogGrouping,
  };
};
