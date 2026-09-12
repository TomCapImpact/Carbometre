import { describe, expect, it } from 'vitest';
import { ModelProfile, type ModelProfileProps } from '../../src/domain/ModelProfile.js';
import { TokenUsage } from '../../src/domain/TokenUsage.js';
import { TokenBasedEmissionModel } from '../../src/emissions/TokenBasedEmissionModel.js';
import type { GridIntensityProvider } from '../../src/grid/GridIntensityProvider.js';

const BASE_PROPS: ModelProfileProps = {
  id: 'test-model',
  label: 'Test model',
  tier: 'frontier',
  emissionModelId: 'token-based',
  eTokenWh: 5.0e-4,
  pue: 1.12,
  regionId: 'us-average',
  regionConfidence: 'assumed',
  embodiedPerTokenG: 4.9e-5,
  hiddenThinkingMultiplier: 1.0,
  thinkingVisible: true,
  uncertaintyFactor: 3.0,
  confidence: 'modelled',
  sources: [],
};

class FixedGridProvider implements GridIntensityProvider {
  constructor(private readonly intensity: number) {}
  intensityFor(): number {
    return this.intensity;
  }
}

describe('TokenBasedEmissionModel', () => {
  it('computes energy, electricity, embodied and total gCO2e from the documented formula', () => {
    const profile = new ModelProfile(BASE_PROPS);
    const model = new TokenBasedEmissionModel(new FixedGridProvider(370));
    const usage = new TokenUsage(50, 500, 0);

    const estimate = model.estimate(usage, profile);

    // energyWh = (500*5e-4 + 50*5e-4*0.05) * 1.12
    expect(estimate.energyWh).toBeCloseTo(0.2814, 10);
    // electricityG = energyWh * 370 / 1000
    expect(estimate.electricityG).toBeCloseTo(0.104118, 10);
    // embodiedG = (500 + 50*0.05) * 4.9e-5
    expect(estimate.embodiedG).toBeCloseTo(0.0246225, 10);
    expect(estimate.gCO2e).toBeCloseTo(0.1287405, 10);
  });

  it('folds hidden/visible thinking tokens into the output side of the formula', () => {
    const profile = new ModelProfile(BASE_PROPS);
    const model = new TokenBasedEmissionModel(new FixedGridProvider(370));

    const withoutThinking = model.estimate(new TokenUsage(0, 100, 0), profile);
    const withThinking = model.estimate(new TokenUsage(0, 100, 300), profile);
    const asIfAllOutput = model.estimate(new TokenUsage(0, 400, 0), profile);

    expect(withThinking.gCO2e).toBeGreaterThan(withoutThinking.gCO2e);
    expect(withThinking.gCO2e).toBeCloseTo(asIfAllOutput.gCO2e, 10);
  });

  it('weights input tokens far below output tokens', () => {
    const profile = new ModelProfile(BASE_PROPS);
    const model = new TokenBasedEmissionModel(new FixedGridProvider(370));

    const outputOnly = model.estimate(new TokenUsage(0, 500, 0), profile);
    const withEqualInput = model.estimate(new TokenUsage(500, 500, 0), profile);

    // Adding 500 input tokens should move the total only slightly (5% weight).
    const delta = withEqualInput.gCO2e - outputOnly.gCO2e;
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(outputOnly.gCO2e * 0.1);
  });

  it('derives the low/high range from the profile uncertaintyFactor alone, regardless of regionConfidence', () => {
    const assumedProfile = new ModelProfile({ ...BASE_PROPS, regionConfidence: 'assumed', uncertaintyFactor: 3 });
    const statedProfile = new ModelProfile({ ...BASE_PROPS, regionConfidence: 'stated', uncertaintyFactor: 3 });
    const model = new TokenBasedEmissionModel(new FixedGridProvider(370));
    const usage = new TokenUsage(0, 500, 0);

    const assumedEstimate = model.estimate(usage, assumedProfile);
    const statedEstimate = model.estimate(usage, statedProfile);

    expect(assumedEstimate.gCO2e).toBeCloseTo(statedEstimate.gCO2e, 10);
    expect(assumedEstimate.gCO2eHigh / assumedEstimate.gCO2e).toBeCloseTo(3, 10);
    expect(statedEstimate.gCO2eHigh / statedEstimate.gCO2e).toBeCloseTo(3, 10);
  });

  it('asks the injected GridIntensityProvider for the intensity, never a hardcoded value', () => {
    const profile = new ModelProfile(BASE_PROPS);
    const highIntensity = new TokenBasedEmissionModel(new FixedGridProvider(1000));
    const lowIntensity = new TokenBasedEmissionModel(new FixedGridProvider(10));
    const usage = new TokenUsage(0, 500, 0);

    expect(highIntensity.estimate(usage, profile).electricityG).toBeGreaterThan(
      lowIntensity.estimate(usage, profile).electricityG,
    );
  });

  it('carries the profile confidence through to the estimate', () => {
    const model = new TokenBasedEmissionModel(new FixedGridProvider(370));
    const guessedProfile = new ModelProfile({ ...BASE_PROPS, confidence: 'guessed' });
    expect(model.estimate(new TokenUsage(0, 10, 0), guessedProfile).confidence).toBe('guessed');
  });
});
