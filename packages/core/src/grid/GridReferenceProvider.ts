import type { ModelProfile } from '../domain/ModelProfile.js';
import type { UserLocation, UserLocationSink } from '../domain/UserLocation.js';
import { DEFAULT_GRID_REFERENCE, type GridReference } from './GridReference.js';
import type { GridIntensityProvider } from './GridIntensityProvider.js';

/**
 * Routes to one of two providers according to the user's electricity
 * reference setting. The datacentre branch is the location-aware one, so
 * this also forwards the user's location to it; the French-mix branch
 * ignores location by definition.
 */
export class GridReferenceProvider implements GridIntensityProvider, UserLocationSink {
  private reference: GridReference;

  constructor(
    private readonly datacenter: GridIntensityProvider & UserLocationSink,
    private readonly frenchMix: GridIntensityProvider,
    initialReference: GridReference = DEFAULT_GRID_REFERENCE,
  ) {
    this.reference = initialReference;
  }

  setReference(reference: GridReference): void {
    this.reference = reference;
  }

  gridReference(): GridReference {
    return this.reference;
  }

  setUserLocation(location: UserLocation): void {
    this.datacenter.setUserLocation(location);
  }

  intensityFor(profile: ModelProfile): number {
    return this.reference === 'french-mix'
      ? this.frenchMix.intensityFor(profile)
      : this.datacenter.intensityFor(profile);
  }
}
