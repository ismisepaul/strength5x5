import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { STORAGE_KEY } from '../../constants';
import legacyBackup from '../../test/fixtures/legacy-backup.json';
import { validateImportData } from '../../utils';

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
    await user.click(screen.getByText('Backup'));

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
