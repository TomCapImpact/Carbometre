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

type ChangeHandler = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void;

function fakeOnChanged(): { api: { addListener: (h: ChangeHandler) => void; removeListener: (h: ChangeHandler) => void }; fire: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void; count: () => number } {
  const handlers = new Set<ChangeHandler>();
  return {
    api: { addListener: (h) => handlers.add(h), removeListener: (h) => handlers.delete(h) },
    fire: (changes, area) => handlers.forEach((h) => h(changes, area)),
    count: () => handlers.size,
  };
}

describe('ChromeStorageSettingsRepository', () => {
  it('returns the defaults when nothing is stored', async () => {
    const repo = new ChromeStorageSettingsRepository(fakeStorageArea(), fakeOnChanged().api);
    expect(await repo.load()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      userLocation: null,
      equivalenceId: 'car-km',
      language: 'auto',
      gridReference: 'datacenter',
      coefficientOverrides: {},
    });
  });

  it('round-trips a full settings object through storage', async () => {
    const area = fakeStorageArea();
    const saved = {
      userLocation: 'fr' as const,
      equivalenceId: 'plane-km' as const,
      language: 'en' as const,
      gridReference: 'french-mix' as const,
      coefficientOverrides: { 'claude-frontier': { pue: 1.2 } },
    };
    await new ChromeStorageSettingsRepository(area, fakeOnChanged().api).save(saved);
    expect(await new ChromeStorageSettingsRepository(area, fakeOnChanged().api).load()).toEqual(saved);
  });

  it('falls back field by field on values it does not recognise (older versions, hand edits)', () => {
    expect(
      settingsFromStored({
        userLocation: 'mars',
        equivalenceId: 'ac-hours',
        language: 'de',
        gridReference: 'market-based',
        coefficientOverrides: {
          'claude-frontier': { pue: 0.5, eTokenWh: 2e-4, regionId: 'fr' },
          'gpt-mid': 'garbage',
          'mistral-small': { pue: 'high' },
        },
        unrelated: true,
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      coefficientOverrides: { 'claude-frontier': { eTokenWh: 2e-4 } },
    });
    expect(settingsFromStored('not an object')).toEqual(DEFAULT_SETTINGS);
  });

  it('notifies listeners of changes to its own key in the local area only, and unsubscribes cleanly', () => {
    const changed = fakeOnChanged();
    const repo = new ChromeStorageSettingsRepository(fakeStorageArea(), changed.api);
    const seen: unknown[] = [];
    const stop = repo.onChange((settings) => seen.push(settings));

    changed.fire({ 'carbometre:settings': { newValue: { language: 'fr' } } }, 'local');
    changed.fire({ 'carbometre:dailyUsage': { newValue: {} } }, 'local');
    changed.fire({ 'carbometre:settings': { newValue: { language: 'en' } } }, 'sync');

    expect(seen).toEqual([{ ...DEFAULT_SETTINGS, language: 'fr' }]);

    stop();
    expect(changed.count()).toBe(0);
    changed.fire({ 'carbometre:settings': { newValue: { language: 'en' } } }, 'local');
    expect(seen).toHaveLength(1);
  });
});
