import {
  type CoefficientOverride,
  type CoefficientOverrides,
  DEFAULT_EQUIVALENCE_ID,
  DEFAULT_GRID_REFERENCE,
  isEditableCoefficient,
  isEquivalenceId,
  isGridReference,
  isUserLocation,
  isValidCoefficientValue,
} from '@carbometre/core';
import { DEFAULT_UI_LANGUAGE, isUiLanguage } from '../i18n/UiLanguage.js';
import type { Unsubscribe } from '../types.js';
import type { Settings, SettingsRepository } from './SettingsRepository.js';

const STORAGE_KEY = 'carbometre:settings';

export const DEFAULT_SETTINGS: Settings = {
  userLocation: null,
  equivalenceId: DEFAULT_EQUIVALENCE_ID,
  language: DEFAULT_UI_LANGUAGE,
  gridReference: DEFAULT_GRID_REFERENCE,
  coefficientOverrides: {},
};

/**
 * Storage is untyped and may hold values written by an older version or
 * by hand, so every field is validated on the way in and falls back to
 * its default rather than throwing. Exported so the Options page can
 * reuse it when reading back what it wrote.
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
    gridReference: isGridReference(stored.gridReference) ? stored.gridReference : DEFAULT_SETTINGS.gridReference,
    coefficientOverrides: sanitizeOverrides(stored.coefficientOverrides),
  };
}

function sanitizeOverrides(raw: unknown): CoefficientOverrides {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }
  const result: Record<string, CoefficientOverride> = {};
  for (const [modelId, override] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof override !== 'object' || override === null) {
      continue;
    }
    const clean: CoefficientOverride = {};
    for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
      if (isEditableCoefficient(key) && isValidCoefficientValue(key, value)) {
        clean[key] = value;
      }
    }
    if (Object.keys(clean).length > 0) {
      result[modelId] = clean;
    }
  }
  return result;
}

/**
 * Shared by the content script, the onboarding page and the Options
 * page, which are separate bundles: all read and write the same key, so
 * the shape and validation live here and nowhere else.
 */
export class ChromeStorageSettingsRepository implements SettingsRepository {
  constructor(
    private readonly storageArea: chrome.storage.StorageArea = chrome.storage.local,
    private readonly changes: Pick<typeof chrome.storage.onChanged, 'addListener' | 'removeListener'> = chrome.storage
      .onChanged,
  ) {}

  async load(): Promise<Settings> {
    const result = (await this.storageArea.get(STORAGE_KEY)) as Record<string, unknown>;
    return settingsFromStored(result[STORAGE_KEY]);
  }

  async save(settings: Settings): Promise<void> {
    await this.storageArea.set({ [STORAGE_KEY]: settings });
  }

  onChange(listener: (settings: Settings) => void): Unsubscribe {
    const handler = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
      const change = changes[STORAGE_KEY];
      if (areaName === 'local' && change) {
        listener(settingsFromStored(change.newValue));
      }
    };
    this.changes.addListener(handler);
    return () => this.changes.removeListener(handler);
  }
}
