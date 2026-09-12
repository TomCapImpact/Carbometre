import type { ModelProfile } from '../domain/ModelProfile.js';
import type { GridIntensityProvider } from './GridIntensityProvider.js';
import regionTable from './regions.json' with { type: 'json' };

export interface RegionEntry {
  readonly factor: number;
  readonly note: string;
}

export type RegionTable = Readonly<Record<string, RegionEntry>>;

const DEFAULT_REGIONS: RegionTable = regionTable;

/**
 * v1 default. Resolves the model's `regionId` against a table of regional
 * grid averages - i.e. where the electricity is actually drawn, not where
 * the user lives and not the provider's renewable-energy certificates
 * (location-based, never market-based; see METHODOLOGY.md).
 */
export class DatacenterGridProvider implements GridIntensityProvider {
  constructor(private readonly regions: RegionTable = DEFAULT_REGIONS) {}

  intensityFor(profile: ModelProfile): number {
    const region = this.regions[profile.regionId];
    if (!region) {
      throw new Error(`DatacenterGridProvider: unknown regionId "${profile.regionId}"`);
    }
    return region.factor;
  }
}
