import { Estimate } from '../domain/Estimate.js';
import type { ModelProfile } from '../domain/ModelProfile.js';
import type { TokenUsage } from '../domain/TokenUsage.js';
import type { GridIntensityProvider } from '../grid/GridIntensityProvider.js';
import type { EmissionModel } from './EmissionModel.js';

/** Prefill (input) is batched and parallelised, far cheaper per token than decode. */
export const DEFAULT_INPUT_WEIGHT = 0.05;

/**
 * v1's only EmissionModel: emissions scale linearly with token count.
 *   energyWh     = (effectiveOutputTokens * eTokenWh + tokensIn * eTokenWh * INPUT_WEIGHT) * pue
 *   electricityG = energyWh * gridIntensity / 1000
 *   embodiedG    = (effectiveOutputTokens + tokensIn * INPUT_WEIGHT) * embodiedPerTokenG
 *   gCO2e        = electricityG + embodiedG
 * `effectiveOutputTokens` already folds in hidden reasoning (TokenUsage.effectiveOutputTokens).
 * The grid factor is resolved through the injected provider, never read directly from the profile.
 */
export class TokenBasedEmissionModel implements EmissionModel {
  constructor(
    private readonly gridIntensityProvider: GridIntensityProvider,
    private readonly inputWeight: number = DEFAULT_INPUT_WEIGHT,
  ) {}

  estimate(usage: TokenUsage, profile: ModelProfile): Estimate {
    const effectiveOutputTokens = usage.effectiveOutputTokens;
    const weightedInputTokens = usage.tokensIn * this.inputWeight;

    const energyWh =
      (effectiveOutputTokens * profile.eTokenWh + weightedInputTokens * profile.eTokenWh) * profile.pue;

    const gridIntensity = this.gridIntensityProvider.intensityFor(profile);
    const electricityG = (energyWh * gridIntensity) / 1000;
    const embodiedG = (effectiveOutputTokens + weightedInputTokens) * profile.embodiedPerTokenG;

    return Estimate.fromEnergyBreakdown({
      usage,
      energyWh,
      electricityG,
      embodiedG,
      uncertaintyFactor: profile.uncertaintyFactor,
      confidence: profile.confidence,
    });
  }
}
