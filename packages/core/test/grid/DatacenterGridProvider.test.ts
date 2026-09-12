import { describe, expect, it } from 'vitest';
import { ModelProfile, type ModelProfileProps } from '../../src/domain/ModelProfile.js';
import { DatacenterGridProvider } from '../../src/grid/DatacenterGridProvider.js';

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

describe('DatacenterGridProvider', () => {
  it('resolves the profile regionId to its grid factor, matching regions.json', () => {
    const provider = new DatacenterGridProvider();
    expect(provider.intensityFor(new ModelProfile({ ...BASE_PROPS, regionId: 'us-average' }))).toBe(370);
    expect(provider.intensityFor(new ModelProfile({ ...BASE_PROPS, regionId: 'us-east' }))).toBe(380);
    expect(provider.intensityFor(new ModelProfile({ ...BASE_PROPS, regionId: 'us-west' }))).toBe(120);
    expect(provider.intensityFor(new ModelProfile({ ...BASE_PROPS, regionId: 'eu-west' }))).toBe(290);
    expect(provider.intensityFor(new ModelProfile({ ...BASE_PROPS, regionId: 'fr' }))).toBe(60);
  });

  it('throws on an unknown regionId rather than silently guessing', () => {
    const provider = new DatacenterGridProvider();
    const profile = new ModelProfile({ ...BASE_PROPS, regionId: 'mars-base-one' });
    expect(() => provider.intensityFor(profile)).toThrow(/mars-base-one/);
  });

  it('accepts a custom region table, e.g. for tests or a future live source', () => {
    const provider = new DatacenterGridProvider({ 'custom-region': { factor: 42, note: 'test fixture' } });
    const profile = new ModelProfile({ ...BASE_PROPS, regionId: 'custom-region' });
    expect(provider.intensityFor(profile)).toBe(42);
  });
});
