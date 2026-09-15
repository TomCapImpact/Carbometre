/**
 * Where the user mainly is, as answered at install time (see the
 * extension's onboarding page). Two values only, on purpose: v1 keeps one
 * explicable rule per location rather than a per-country table.
 *
 * It affects two things - see UserLocationGridProvider and
 * EquivalenceCatalog - and is never inferred from the browser locale, since
 * an English UI says nothing about where someone lives.
 */
export type UserLocation = 'fr' | 'other';

export const USER_LOCATIONS: readonly UserLocation[] = ['fr', 'other'];

export function isUserLocation(value: unknown): value is UserLocation {
  return typeof value === 'string' && (USER_LOCATIONS as readonly string[]).includes(value);
}

/**
 * Used until the user answers. 'other' is the choice that assumes nothing
 * favourable: it keeps every model on its datacentre's own grid.
 */
export const DEFAULT_USER_LOCATION: UserLocation = 'other';

/** Something whose behaviour depends on the user's location and can be told when it changes. */
export interface UserLocationSink {
  setUserLocation(location: UserLocation): void;
}
