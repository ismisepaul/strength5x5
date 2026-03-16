import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const mockState = {
  weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
  history: [{ date: '2026-03-10T12:00:00.000Z', type: 'A', exercises: [{ id: 'squat', weight: 60, setsCompleted: [5, 5, 5, 5, 5] }] }],
  nextType: 'B',
  isDark: true,
  autoSave: true,
  preferredRest: 90,
  soundEnabled: false,
  vibrationEnabled: false,
  logGrouping: 'all',
};

function setupGoogleMock(tokenCallback) {
  const requestAccessToken = vi.fn(() => {
    tokenCallback?.({ access_token: 'test-token', expires_in: 3600 });
  });
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn(({ callback }) => {
          tokenCallback = (resp) => callback(resp);
          return { requestAccessToken };
        }),
      },
    },
  };
  return requestAccessToken;
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
  vi.restoreAllMocks();
  delete window.google;
  global.fetch = vi.fn();
});

describe('useGoogleDrive', () => {
  it('starts disconnected and not loading', () => {
    setupGoogleMock();
    const { result } = renderHook(() => useGoogleDrive());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  describe('save', () => {
    it('creates a new file when none exists on Drive', async () => {
      let authCallback;
      setupGoogleMock();
      window.google.accounts.oauth2.initTokenClient = vi.fn(({ callback }) => {
        authCallback = callback;
        return { requestAccessToken: vi.fn(() => authCallback({ access_token: 'test-token', expires_in: 3600 })) };
      });

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-file-id' }) });

      const { result } = renderHook(() => useGoogleDrive());

      let saveResult;
      await act(async () => {
        saveResult = await result.current.save(mockState);
      });

      expect(saveResult.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      const searchCall = global.fetch.mock.calls[0];
      expect(searchCall[0]).toContain(DRIVE_API);
      expect(searchCall[0]).toContain('appProperties');

      const uploadCall = global.fetch.mock.calls[1];
      expect(uploadCall[0]).toContain(DRIVE_UPLOAD);
      expect(uploadCall[1].method).toBe('POST');
    });

    it('updates existing file when one exists on Drive', async () => {
      let authCallback;
      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn(({ callback }) => {
              authCallback = callback;
              return { requestAccessToken: vi.fn(() => authCallback({ access_token: 'test-token', expires_in: 3600 })) };
            }),
          },
        },
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: 'existing-id', name: 'strength5x5_backup_v1.json' }] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'existing-id' }) });

      const { result } = renderHook(() => useGoogleDrive());

      let saveResult;
      await act(async () => {
        saveResult = await result.current.save(mockState);
      });

      expect(saveResult.success).toBe(true);
      const uploadCall = global.fetch.mock.calls[1];
      expect(uploadCall[0]).toContain('existing-id');
      expect(uploadCall[1].method).toBe('PATCH');
    });

    it('returns error when Drive search fails', async () => {
      let authCallback;
      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn(({ callback }) => {
              authCallback = callback;
              return { requestAccessToken: vi.fn(() => authCallback({ access_token: 'test-token', expires_in: 3600 })) };
            }),
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 });

      const { result } = renderHook(() => useGoogleDrive());

      let saveResult;
      await act(async () => {
        saveResult = await result.current.save(mockState);
      });

      expect(saveResult.success).toBe(false);
      expect(saveResult.error).toBe('driveError');
    });
  });

  describe('restore', () => {
    it('downloads and validates backup data', async () => {
      let authCallback;
      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn(({ callback }) => {
              authCallback = callback;
              return { requestAccessToken: vi.fn(() => authCallback({ access_token: 'test-token', expires_in: 3600 })) };
            }),
          },
        },
      };

      const cloudData = {
        weights: { squat: 70, bench: 50, row: 55, press: 35, deadlift: 90 },
        history: [{ date: '2026-03-15T12:00:00.000Z', type: 'A', exercises: [{ id: 'squat', weight: 70, setsCompleted: [5, 5, 5, 5, 5] }] }],
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: 'file-id' }] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => cloudData });

      const { result } = renderHook(() => useGoogleDrive());

      let restoreResult;
      await act(async () => {
        restoreResult = await result.current.restore(mockState.history);
      });

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.stale).toBe(false);
      expect(restoreResult.data.weights.squat).toBe(70);
    });

    it('returns driveNoBackup when no file exists', async () => {
      let authCallback;
      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn(({ callback }) => {
              authCallback = callback;
              return { requestAccessToken: vi.fn(() => authCallback({ access_token: 'test-token', expires_in: 3600 })) };
            }),
          },
        },
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) });

      const { result } = renderHook(() => useGoogleDrive());

      let restoreResult;
      await act(async () => {
        restoreResult = await result.current.restore([]);
      });

      expect(restoreResult.success).toBe(false);
      expect(restoreResult.error).toBe('driveNoBackup');
    });

    it('flags stale data when cloud backup is older than local', async () => {
      let authCallback;
      window.google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn(({ callback }) => {
              authCallback = callback;
              return { requestAccessToken: vi.fn(() => authCallback({ access_token: 'test-token', expires_in: 3600 })) };
            }),
          },
        },
      };

      const olderCloudData = {
        weights: { squat: 50, bench: 40, row: 45, press: 30, deadlift: 70 },
        history: [{ date: '2026-03-01T12:00:00.000Z', type: 'A', exercises: [{ id: 'squat', weight: 50, setsCompleted: [5, 5, 5, 5, 5] }] }],
      };
      const newerLocalHistory = [{ date: '2026-03-15T12:00:00.000Z', type: 'B', exercises: [{ id: 'squat', weight: 70, setsCompleted: [5, 5, 5, 5, 5] }] }];

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: 'file-id' }] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => olderCloudData });

      const { result } = renderHook(() => useGoogleDrive());

      let restoreResult;
      await act(async () => {
        restoreResult = await result.current.restore(newerLocalHistory);
      });

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.stale).toBe(true);
      expect(restoreResult.cloudDate).toBeTruthy();
      expect(restoreResult.localDate).toBeTruthy();
    });
  });

  describe('auth', () => {
    it('returns error when GIS is not loaded', async () => {
      const { result } = renderHook(() => useGoogleDrive());

      let saveResult;
      await act(async () => {
        saveResult = await result.current.save(mockState);
      });

      expect(saveResult.success).toBe(false);
      expect(saveResult.error).toBe('driveError');
    });

    it('returns error when client ID is not configured', async () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
      setupGoogleMock();

      const { result } = renderHook(() => useGoogleDrive());

      let saveResult;
      await act(async () => {
        saveResult = await result.current.save(mockState);
      });

      expect(saveResult.success).toBe(false);
    });
  });
});
