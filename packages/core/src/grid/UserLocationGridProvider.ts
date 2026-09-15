import type { ModelProfile } from '../domain/ModelProfile.js';
import { DEFAULT_USER_LOCATION, type UserLocation, type UserLocationSink } from '../domain/UserLocation.js';
import { FRENCH_GRID_INTENSITY } from './FrenchGridProvider.js';
import type { GridIntensityProvider } from './GridIntensityProvider.js';

/** Region ids counted as "hosted in Europe" for the rule below. */
const EUROPEAN_REGION_PREFIXES: readonly string[] = ['eu-', 'fr'];

export function isEuropeanRegion(regionId: string): boolean {
  return EUROPEAN_REGION_PREFIXES.some((prefix) => regionId.startsWith(prefix));
}

/**
 * Decorates another provider with one location-dependent rule:
 *
 *   user mainly in France  AND  model hosted in Europe  ->  French grid mix
 *   anything else                                       ->  the wrapped provider
 *
 * So a French user querying Mistral is charged 30 gCO2e/kWh instead of the
 * Irish average, while ChatGPT and Claude - served from the US whoever asks -
 * keep their datacentre's grid. Applying the French mix to those too would
 * understate them ~12x; that was considered and declined (METHODOLOGY.md §5).
 *
 * The location is mutable because the user can change it from the dashboard
 * at any time; only estimates made after the change are affected.
 */
export class UserLocationGridProvider implements GridIntensityProvider, UserLocationSink {
  private location: UserLocation;

  constructor(
    private readonly fallback: GridIntensityProvider,
    initialLocation: UserLocation = DEFAULT_USER_LOCATION,
  ) {
    this.location = initialLocation;
  }

  setUserLocation(location: UserLocation): void {
    this.location = location;
  }

  userLocation(): UserLocation {
    return this.location;
  }

  intensityFor(profile: ModelProfile): number {
    if (this.location === 'fr' && isEuropeanRegion(profile.regionId)) {
      return FRENCH_GRID_INTENSITY;
    }
    return this.fallback.intensityFor(profile);
  }
}
