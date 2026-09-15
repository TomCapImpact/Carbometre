import { describe, expect, it, vi } from 'vitest';
import { ChromeStorageSettingsRepository, DEFAULT_SETTINGS } from '../../src/storage/ChromeStorageSettingsRepository.js';

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
  it('returns the defaults when nothing is stored: location unanswered, car equivalence', async () => {
    const repo = new ChromeStorageSettingsRepository(fakeStorageArea());
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.userLocation).toBeNull();
    expect(DEFAULT_SETTINGS.equivalenceId).toBe('car-km');
  });

  it('round-trips a saved value through storage', async () => {
    const area = fakeStorageArea();
    await new ChromeStorageSettingsRepository(area).save({ userLocation: 'fr', equivalenceId: 'plane-km' });
    expect(await new ChromeStorageSettingsRepository(area).load()).toEqual({
      userLocation: 'fr',
      equivalenceId: 'plane-km',
    });
  });

  it('falls back field by field on values it does not recognise (older versions, hand edits)', async () => {
    const area = fakeStorageArea({
      'carbometre:settings': { userLocation: 'mars', equivalenceId: 'plane-km', unrelated: true },
    });
    expect(await new ChromeStorageSettingsRepository(area).load()).toEqual({
      userLocation: null,
      equivalenceId: 'plane-km',
    });
  });

  it('tolerates garbage at the top level rather than throwing', async () => {
    const area = fakeStorageArea({ 'carbometre:settings': 'not an object' });
    expect(await new ChromeStorageSettingsRepository(area).load()).toEqual(DEFAULT_SETTINGS);
  });
});
