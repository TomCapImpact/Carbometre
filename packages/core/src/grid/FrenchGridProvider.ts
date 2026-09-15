import type { ModelProfile } from '../domain/ModelProfile.js';
import type { GridIntensityProvider } from './GridIntensityProvider.js';
import regionTable from './regions.json' with { type: 'json' };

/**
 * French grid mix, gCO2e/kWh - read from the "fr" entry of regions.json so
 * there is exactly one place to update it (it drifted once: 60 here while
 * the table already said 30).
 */
export const FRENCH_GRID_INTENSITY: number = regionTable.fr.factor;

/**
 * Optional comparison mode: charges every model at the French grid mix
 * regardless of where it actually runs. Never the default, since it
 * understates the true footprint of non-French-hosted models.
 */
export class FrenchGridProvider implements GridIntensityProvider {
  intensityFor(_profile: ModelProfile): number {
    return FRENCH_GRID_INTENSITY;
  }
}
