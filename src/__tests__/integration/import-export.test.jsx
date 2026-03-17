import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import i18n from '../../i18n/index.js';
import { STORAGE_KEY } from '../../constants';
import legacyBackup from '../../test/fixtures/legacy-backup.json';
import { validateImportData } from '../../utils';

const CSV_HEADER = 'Date (yyyy/mm/dd),Workout,Workout Name,Program Name,Body Weight (KG),Exercise,SetsxReps,SetsxTime,Top Set Reps x KG,e1RM  (KG),Reps,Volume (KG),Workout Volume (KG),Duration (hours),Start Time (h:mm),End Time (h:mm),Notes,Set 1 (Reps), Set 1 (KG),Set 2 (Reps), Set 2 (KG),Set 3 (Reps), Set 3 (KG),Set 4 (Reps), Set 4 (KG),Set 5 (Reps), Set 5 (KG)';

const VALID_CSV = [
  CSV_HEADER,
  '"2024/01/01","1","Workout A","","75","Squat","5x5","","","","","","","","","","","5","40","5","40","5","40","5","40","5","40"',
  '"2024/01/01","1","Workout A","","75","Bench Press","5x5","","","","","","","","","","","5","30","5","30","5","30","5","30","5","30"',
  '"2024/01/01","1","Workout A","","75","Barbell Row","5x5","","","","","","","","","","","5","35","5","35","5","35","5","35","5","35"',
].join('\n');

beforeEach(() => {
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

describe('Import / Export', () => {
  it('legacy backup passes validation', () => {
    const result = validateImportData(legacyBackup);
    expect(result).not.toBeNull();
    expect(result.weights.squat).toBe(60);
    expect(result.weights.bench).toBe(45);
    expect(result.history).toHaveLength(2);
  });

  it('legacy backup weights are normalized to 2.5kg increments', () => {
    const result = validateImportData(legacyBackup);
    for (const key of Object.keys(result.weights)) {
      expect(result.weights[key] % 2.5).toBe(0);
    }
  });

  it('exports data when backup button is clicked', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [],
      nextType: 'A',
      isDark: true,
      autoSave: false,
      preferredRest: 90,
      soundEnabled: false,
      vibrationEnabled: false,
    }));

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));
    await user.click(screen.getByText('Backup to Device'));

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('imports valid data from a JSON file', async () => {
    render(<App />);

    const user = userEvent.setup();
    await user.click(screen.getByText('Options'));

    const input = document.querySelector('input[type="file"]');
    const file = new File(
      [JSON.stringify(legacyBackup)],
      'backup.json',
      { type: 'application/json' }
    );

    fireEvent.change(input, { target: { files: [file] } });

    await vi.waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored.weights.squat).toBe(60);
    });
  });

  it('restores language preference from backup', async () => {
    expect(i18n.language).toMatch(/^en/);
    render(<App />);

    const user = userEvent.setup();
    await user.click(screen.getByText('Options'));

    const input = document.querySelector('input[type="file"]');
    const backupWithLang = { ...legacyBackup, version: 1, language: 'fr' };
    const file = new File(
      [JSON.stringify(backupWithLang)],
      'backup.json',
      { type: 'application/json' }
    );

    fireEvent.change(input, { target: { files: [file] } });

    await vi.waitFor(() => {
      expect(i18n.language).toBe('fr');
    });

    i18n.changeLanguage('en');
  });

  it('rejects invalid import data', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<App />);

    const user = userEvent.setup();
    await user.click(screen.getByText('Options'));

    const input = document.querySelector('input[type="file"]');
    const invalidData = { notWeights: true };
    const file = new File(
      [JSON.stringify(invalidData)],
      'bad.json',
      { type: 'application/json' }
    );

    fireEvent.change(input, { target: { files: [file] } });

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('Import failed: invalid data structure');
    });

    warnSpy.mockRestore();
  });

  it('rejects files over 5MB', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<App />);

    const user = userEvent.setup();
    await user.click(screen.getByText('Options'));

    const input = document.querySelector('input[type="file"]');
    const bigContent = 'x'.repeat(6 * 1024 * 1024);
    const file = new File([bigContent], 'huge.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file] } });

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('Import rejected: file exceeds 5MB limit');
    });

    warnSpy.mockRestore();
  });
});

describe('Import conflict resolution', () => {
  const existingData = {
    version: 1,
    weights: { squat: 80, bench: 60, row: 65, press: 45, deadlift: 100 },
    history: [
      { date: '2026-03-10T10:00:00.000Z', type: 'A', exercises: [{ id: 'squat', weight: 80, setsCompleted: [5, 5, 5, 5, 5] }] },
      { date: '2026-03-08T10:00:00.000Z', type: 'B', exercises: [{ id: 'squat', weight: 77.5, setsCompleted: [5, 5, 5, 5, 5] }] },
      { date: '2026-03-06T10:00:00.000Z', type: 'A', exercises: [{ id: 'squat', weight: 75, setsCompleted: [5, 5, 5, 5, 5] }] },
    ],
    nextType: 'B',
    isDark: true,
    autoSave: false,
    preferredRest: 90,
    soundEnabled: false,
    vibrationEnabled: false,
  };

  const smallerBackup = {
    app: 'Strength 5x5',
    version: 1,
    weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
    history: [
      { date: '2026-03-01T10:00:00.000Z', type: 'A', exercises: [{ id: 'squat', weight: 60, setsCompleted: [5, 5, 5, 5, 5] }] },
    ],
    nextType: 'B',
    isDark: true,
    autoSave: false,
  };

  it('shows warning when importing a file with fewer workouts than local', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const input = document.querySelector('input[type="file"][accept=".json"]');
    const file = new File([JSON.stringify(smallerBackup)], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Older Backup')).toBeTruthy();
      expect(screen.getByText(/1 workouts/)).toBeTruthy();
      expect(screen.getByText(/3 workouts/)).toBeTruthy();
      expect(screen.getByText(/lose 2 workouts/)).toBeTruthy();
    });
  });

  it('applies import when user confirms warning', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const input = document.querySelector('input[type="file"][accept=".json"]');
    const file = new File([JSON.stringify(smallerBackup)], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Older Backup')).toBeTruthy();
    });

    await user.click(screen.getByText('Restore Anyway'));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored.weights.squat).toBe(60);
      expect(stored.history).toHaveLength(1);
    });
  });

  it('preserves local data when user cancels warning', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const input = document.querySelector('input[type="file"][accept=".json"]');
    const file = new File([JSON.stringify(smallerBackup)], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Older Backup')).toBeTruthy();
    });

    await user.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Older Backup')).toBeNull();
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(80);
    expect(stored.history).toHaveLength(3);
  });

  it('applies import directly when file has equal or more workouts', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...existingData,
      history: [existingData.history[0]],
    }));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Options'));

    const largerBackup = { ...smallerBackup, history: [
      { date: '2026-03-05T10:00:00.000Z', type: 'A', exercises: [{ id: 'squat', weight: 55, setsCompleted: [5, 5, 5, 5, 5] }] },
      { date: '2026-03-03T10:00:00.000Z', type: 'B', exercises: [{ id: 'squat', weight: 52.5, setsCompleted: [5, 5, 5, 5, 5] }] },
    ]};
    const input = document.querySelector('input[type="file"][accept=".json"]');
    const file = new File([JSON.stringify(largerBackup)], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored.history).toHaveLength(2);
    });

    expect(screen.queryByText('Older Backup')).toBeNull();
  });
});

describe('StrongLifts CSV Import', () => {
  it('shows Import StrongLifts button in Settings', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Options'));
    expect(screen.getByText('Import StrongLifts')).toBeTruthy();
  });

  it('opens confirmation modal with session count after selecting a CSV file', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Options'));

    const csvInput = document.querySelector('input[accept=".csv"]');
    const file = new File([VALID_CSV], 'stronglifts.csv', { type: 'text/csv' });

    fireEvent.change(csvInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Import StrongLifts Data?')).toBeTruthy();
      expect(screen.getByText(/Found 1 workouts/)).toBeTruthy();
    });
  });

  it('applies data to state when confirming CSV import', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Options'));

    const csvInput = document.querySelector('input[accept=".csv"]');
    const file = new File([VALID_CSV], 'stronglifts.csv', { type: 'text/csv' });

    fireEvent.change(csvInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Import StrongLifts Data?')).toBeTruthy();
    });

    const modal = screen.getByLabelText('Confirm StrongLifts import');
    const importBtn = modal.querySelector('button');
    await user.click(importBtn);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored.weights.squat).toBe(40);
      expect(stored.weights.bench).toBe(30);
      expect(stored.weights.row).toBe(35);
    });
  });

  it('does not modify state when cancelling CSV import', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      weights: { squat: 60, bench: 45, row: 50, press: 32.5, deadlift: 80 },
      history: [], nextType: 'A', isDark: true, autoSave: false,
      preferredRest: 90, soundEnabled: false, vibrationEnabled: false,
    }));

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Options'));

    const csvInput = document.querySelector('input[accept=".csv"]');
    const file = new File([VALID_CSV], 'stronglifts.csv', { type: 'text/csv' });

    fireEvent.change(csvInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Import StrongLifts Data?')).toBeTruthy();
    });

    await user.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Import StrongLifts Data?')).toBeNull();
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.weights.squat).toBe(60);
  });

  it('shows Import StrongLifts option in first-launch restore prompt', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Start Workout'));

    await waitFor(() => {
      expect(screen.getByText('Sync History?')).toBeTruthy();
      expect(screen.getByText(/Import StrongLifts/)).toBeTruthy();
    });
  });

  it('warns on invalid CSV without crashing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Options'));

    const csvInput = document.querySelector('input[accept=".csv"]');
    const file = new File(['just,some,garbage'], 'bad.csv', { type: 'text/csv' });

    fireEvent.change(csvInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('StrongLifts import failed'));
    });

    expect(screen.queryByText('Import StrongLifts Data?')).toBeNull();
    warnSpy.mockRestore();
  });
});
