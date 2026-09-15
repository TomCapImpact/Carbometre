import type { CoefficientOverrides, EquivalenceId, GridReference, UserLocation } from '@carbometre/core';
import type { UiLanguage } from '../i18n/UiLanguage.js';
import type { Unsubscribe } from '../types.js';

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
  readonly gridReference: GridReference;
  readonly coefficientOverrides: CoefficientOverrides;
}

export interface SettingsRepository {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
  /**
   * Fires with the new settings whenever they change - including from
   * another page of the extension (the Options page saving while a chat
   * tab is open). Not fired for the caller's own save().
   */
  onChange(listener: (settings: Settings) => void): Unsubscribe;
}
