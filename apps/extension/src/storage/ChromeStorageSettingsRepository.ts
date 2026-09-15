import { DEFAULT_EQUIVALENCE_ID, isEquivalenceId, isUserLocation } from '@carbometre/core';
import { DEFAULT_UI_LANGUAGE, isUiLanguage } from '../i18n/UiLanguage.js';
import type { Settings, SettingsRepository } from './SettingsRepository.js';

const STORAGE_KEY = 'carbometre:settings';

export const DEFAULT_SETTINGS: Settings = {
  userLocation: null,
  equivalenceId: DEFAULT_EQUIVALENCE_ID,
  language: DEFAULT_UI_LANGUAGE,
};

/**
 * Storage is untyped and may hold values written by an older version or
 * by hand, so every field is validated on the way in and falls back to
 * its default rather than throwing.
 */
export function settingsFromStored(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_SETTINGS;
  }
  const stored = raw as Record<string, unknown>;
  return {
    userLocation: isUserLocation(stored.userLocation) ? stored.userLocation : DEFAULT_SETTINGS.userLocation,
    equivalenceId: isEquivalenceId(stored.equivalenceId) ? stored.equivalenceId : DEFAULT_SETTINGS.equivalenceId,
    language: isUiLanguage(stored.language) ? stored.language : DEFAULT_SETTINGS.language,
  };
}

/**
 * Shared by the content script, the onboarding page and the Options
 * page, which are separate bundles: all read and write the same key, so
 * the shape and validation live here and nowhere else.
 */
export class ChromeStorageSettingsRepository implements SettingsRepository {
  constructor(private readonly storageArea: chrome.storage.StorageArea = chrome.storage.local) {}

  async load(): Promise<Settings> {
    const result = (await this.storageArea.get(STORAGE_KEY)) as Record<string, unknown>;
    return settingsFromStored(result[STORAGE_KEY]);
  }

  async save(settings: Settings): Promise<void> {
    await this.storageArea.set({ [STORAGE_KEY]: settings });
  }
}
