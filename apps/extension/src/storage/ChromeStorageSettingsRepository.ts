import { DEFAULT_EQUIVALENCE_ID, isEquivalenceId, isUserLocation } from '@carbometre/core';
import type { Settings, SettingsRepository } from './SettingsRepository.js';

const STORAGE_KEY = 'carbometre:settings';

export const DEFAULT_SETTINGS: Settings = {
  userLocation: null,
  equivalenceId: DEFAULT_EQUIVALENCE_ID,
};

/**
 * Shared by the content script and the onboarding page, which are separate
 * bundles: both read and write the same key, so the shape and validation
 * live here and nowhere else. Storage is untyped and may hold values written
 * by an older version, so every field is validated on the way in and falls
 * back to its default rather than throwing.
 */
export class ChromeStorageSettingsRepository implements SettingsRepository {
  constructor(private readonly storageArea: chrome.storage.StorageArea = chrome.storage.local) {}

  async load(): Promise<Settings> {
    const result = (await this.storageArea.get(STORAGE_KEY)) as Record<string, unknown>;
    const raw = result[STORAGE_KEY];
    if (typeof raw !== 'object' || raw === null) {
      return DEFAULT_SETTINGS;
    }
    const stored = raw as Record<string, unknown>;
    return {
      userLocation: isUserLocation(stored.userLocation) ? stored.userLocation : DEFAULT_SETTINGS.userLocation,
      equivalenceId: isEquivalenceId(stored.equivalenceId) ? stored.equivalenceId : DEFAULT_SETTINGS.equivalenceId,
    };
  }

  async save(settings: Settings): Promise<void> {
    await this.storageArea.set({ [STORAGE_KEY]: settings });
  }
}
