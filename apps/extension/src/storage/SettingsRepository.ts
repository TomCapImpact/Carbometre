import type { EquivalenceId, UserLocation } from '@carbometre/core';
import type { UiLanguage } from '../i18n/UiLanguage.js';

/**
 * The user's own choices. `userLocation` is null until the onboarding
 * question is answered - the presenter substitutes DEFAULT_USER_LOCATION
 * for calculation, but the dashboard needs to know the difference to keep
 * asking. Everything else has a real default.
 */
export interface Settings {
  readonly userLocation: UserLocation | null;
  readonly equivalenceId: EquivalenceId;
  readonly language: UiLanguage;
}

export interface SettingsRepository {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}
