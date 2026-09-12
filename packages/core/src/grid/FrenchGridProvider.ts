import type { ModelProfile } from '../domain/ModelProfile.js';
import type { GridIntensityProvider } from './GridIntensityProvider.js';

/** French grid mix, gCO2e/kWh - see regions.json "fr" entry. */
export const FRENCH_GRID_INTENSITY = 60;

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
