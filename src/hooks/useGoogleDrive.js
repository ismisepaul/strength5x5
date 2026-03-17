import { useState, useRef, useCallback } from 'react';
import { SCHEMA_VERSION, MAX_IMPORT_SIZE } from '../constants';
import { validateImportData } from '../utils';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'strength5x5_backup_v1.json';
const APP_PROPERTY_QUERY = "appProperties has { key='app' and value='strength5x5' }";

function getLatestHistoryDate(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  return history.reduce((latest, s) => {
    const d = new Date(s.date);
    return d > latest ? d : latest;
  }, new Date(history[0].date));
}

export function useGoogleDrive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const tokenRef = useRef(null);
  const clientRef = useRef(null);
  const pendingAuthRef = useRef(null);

  const getToken = useCallback(() => {
    return new Promise((resolve, reject) => {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) {
        reject(new Error('VITE_GOOGLE_CLIENT_ID not configured'));
        return;
      }

      if (tokenRef.current) {
        resolve(tokenRef.current);
        return;
      }

      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services not loaded'));
        return;
      }

      if (!clientRef.current) {
        clientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: (response) => {
            const pending = pendingAuthRef.current;
            pendingAuthRef.current = null;

            if (response.error) {
              setIsConnected(false);
              pending?.reject(new Error(response.error));
              return;
            }
            tokenRef.current = response.access_token;
            setIsConnected(true);
            setHasEverConnected(true);
            setTimeout(() => {
              tokenRef.current = null;
              setIsConnected(false);
            }, (response.expires_in - 60) * 1000);
            pending?.resolve(response.access_token);
          },
          error_callback: (err) => {
            const pending = pendingAuthRef.current;
            pendingAuthRef.current = null;
            setIsConnected(false);
            pending?.reject(new Error(err.message || 'Auth cancelled'));
          },
        });
      }

      pendingAuthRef.current = { resolve, reject };
      clientRef.current.requestAccessToken();
    });
  }, []);

  const connect = useCallback(async () => {
    try {
      await getToken();
      return true;
    } catch {
      return false;
    }
  }, [getToken]);

  const findBackupFile = useCallback(async (token) => {
    const params = new URLSearchParams({
      q: APP_PROPERTY_QUERY,
      fields: 'files(id,name,modifiedTime)',
      spaces: 'drive',
      orderBy: 'modifiedTime desc',
    });
    const res = await fetch(`${DRIVE_API}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Drive search failed: ${res.status}`);
    const data = await res.json();
    return data.files?.[0] || null;
  }, []);

  const save = useCallback(async (state) => {
    setIsLoading(true);
    try {
      const json = JSON.stringify({
        app: 'Strength 5x5',
        version: SCHEMA_VERSION,
        ...state,
      }, null, 2);

      if (new Blob([json]).size > MAX_IMPORT_SIZE) {
        return { success: false, error: 'fileTooLarge' };
      }

      const token = await getToken();
      const existing = await findBackupFile(token);

      const metadata = {
        name: BACKUP_FILENAME,
        mimeType: 'application/json',
        ...(!existing && { appProperties: { app: 'strength5x5' } }),
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([json], { type: 'application/json' }));

      const url = existing
        ? `${DRIVE_UPLOAD}/${existing.id}?uploadType=multipart`
        : `${DRIVE_UPLOAD}?uploadType=multipart`;

      const res = await fetch(url, {
        method: existing ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
      const now = new Date();
      setLastSavedAt(now);
      setSaveFailed(false);
      return { success: true, savedAt: now };
    } catch (err) {
      console.warn('Google Drive save failed:', err);
      setSaveFailed(true);
      if (err.message?.includes('Auth cancelled')) return { success: false, error: 'cancelled' };
      return { success: false, error: 'driveError' };
    } finally {
      setIsLoading(false);
    }
  }, [getToken, findBackupFile]);

  const restore = useCallback(async (localHistory) => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const file = await findBackupFile(token);

      if (!file) return { success: false, error: 'driveNoBackup' };

      const res = await fetch(`${DRIVE_API}/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);

      const raw = await res.json();
      const validated = validateImportData(raw);
      if (!validated) return { success: false, error: 'invalidBackup' };

      const cloudDate = getLatestHistoryDate(validated.history);
      const localDate = getLatestHistoryDate(localHistory);

      if (cloudDate && localDate && cloudDate < localDate) {
        return {
          success: true,
          data: validated,
          stale: true,
          cloudDate: cloudDate.toLocaleDateString(),
          localDate: localDate.toLocaleDateString(),
        };
      }

      return { success: true, data: validated, stale: false };
    } catch (err) {
      console.warn('Google Drive restore failed:', err);
      if (err.message?.includes('Auth cancelled')) return { success: false, error: 'cancelled' };
      return { success: false, error: 'driveError' };
    } finally {
      setIsLoading(false);
    }
  }, [getToken, findBackupFile]);

  const checkBackup = useCallback(async () => {
    try {
      const token = await getToken();
      const file = await findBackupFile(token);
      if (!file) return { exists: false };
      return { exists: true, modifiedTime: new Date(file.modifiedTime) };
    } catch {
      return { exists: false };
    }
  }, [getToken, findBackupFile]);

  return { save, restore, connect, checkBackup, isConnected, isLoading, lastSavedAt, saveFailed, hasEverConnected };
}
