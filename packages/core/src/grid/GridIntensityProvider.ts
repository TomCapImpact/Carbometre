import type { ModelProfile } from '../domain/ModelProfile.js';

/**
 * Resolves a model to a carbon intensity for the electricity it consumes,
 * in gCO2e/kWh. Kept separate from EmissionModel so where the grid factor
 * comes from (hosting region, a fixed national mix, a future live API) can
 * change without touching the emission formula.
 */
export interface GridIntensityProvider {
  intensityFor(profile: ModelProfile): number;
}
