import { describe, expect, it, vi } from 'vitest';
import {
  ChromeStorageSettingsRepository,
  DEFAULT_SETTINGS,
  settingsFromStored,
} from '../../src/storage/ChromeStorageSettingsRepository.js';

function fakeStorageArea(seed: Record<string, unknown> = {}): chrome.storage.StorageArea {
  const data = new Map<string, unknown>(Object.entries(seed));
  return {
    get: vi.fn(async (key: string) => ({ [key]: data.get(key) })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
    }),
  } as unknown as chrome.storage.StorageArea;
}

describe('ChromeStorageSettingsRepository', () => {
  it('returns the defaults when nothing is stored', async () => {
    const repo = new ChromeStorageSettingsRepository(fakeStorageArea());
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ userLocation: null, equivalenceId: 'car-km', language: 'auto' });
  });

  it('round-trips a full settings object through storage', async () => {
    const area = fakeStorageArea();
    const saved = { userLocation: 'fr' as const, equivalenceId: 'plane-km' as const, language: 'en' as const };
    await new ChromeStorageSettingsRepository(area).save(saved);
    expect(await new ChromeStorageSettingsRepository(area).load()).toEqual(saved);
  });

  it('falls back field by field on values it does not recognise (older versions, hand edits)', () => {
    expect(
      settingsFromStored({ userLocation: 'mars', equivalenceId: 'plane-km', language: 'de', unrelated: true }),
    ).toEqual({ ...DEFAULT_SETTINGS, equivalenceId: 'plane-km' });
    expect(settingsFromStored('not an object')).toEqual(DEFAULT_SETTINGS);
  });
});
