import type { EquivalenceId, UserLocation } from '@carbometre/core';

/**
 * The user's own choices. Two so far; the Options page (step 5) will add
 * more. `userLocation` is null until the onboarding question is answered -
 * the presenter substitutes DEFAULT_USER_LOCATION for calculation, but the
 * dashboard needs to know the difference to keep asking.
 */
export interface Settings {
  readonly userLocation: UserLocation | null;
  readonly equivalenceId: EquivalenceId;
}

export interface SettingsRepository {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}
