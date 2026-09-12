import type { Estimate } from '../domain/Estimate.js';
import type { ModelProfile } from '../domain/ModelProfile.js';
import type { TokenUsage } from '../domain/TokenUsage.js';

/**
 * Turns a token count into an emission Estimate for a given model. New
 * methodologies (e.g. a future measured-energy model) implement this
 * interface and register under a new id - CarbometerService never changes.
 */
export interface EmissionModel {
  estimate(usage: TokenUsage, profile: ModelProfile): Estimate;
}
