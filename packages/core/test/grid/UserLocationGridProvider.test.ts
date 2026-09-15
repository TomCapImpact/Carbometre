import { describe, expect, it } from 'vitest';
import { ModelProfile, type ModelProfileProps } from '../../src/domain/ModelProfile.js';
import { DatacenterGridProvider } from '../../src/grid/DatacenterGridProvider.js';
import { FRENCH_GRID_INTENSITY } from '../../src/grid/FrenchGridProvider.js';
import { isEuropeanRegion, UserLocationGridProvider } from '../../src/grid/UserLocationGridProvider.js';

const BASE_PROPS: ModelProfileProps = {
  id: 'test-model',
  label: 'Test model',
  tier: 'frontier',
  emissionModelId: 'token-based',
  eTokenWh: 5.0e-4,
  pue: 1.54,
  regionId: 'us-average',
  regionConfidence: 'assumed',
  embodiedPerTokenG: 4.9e-5,
  hiddenThinkingMultiplier: 1.0,
  thinkingVisible: true,
  uncertaintyFactor: 3.0,
  confidence: 'modelled',
  sources: [],
};

const usHosted = new ModelProfile({ ...BASE_PROPS, regionId: 'us-average' });
const euHosted = new ModelProfile({ ...BASE_PROPS, regionId: 'eu-west' });
const datacenter = new DatacenterGridProvider();

describe('isEuropeanRegion', () => {
  it('recognises eu-* and fr, and nothing American', () => {
    expect(isEuropeanRegion('eu-west')).toBe(true);
    expect(isEuropeanRegion('fr')).toBe(true);
    expect(isEuropeanRegion('us-average')).toBe(false);
    expect(isEuropeanRegion('us-east')).toBe(false);
  });
});

describe('UserLocationGridProvider', () => {
  it('defaults to "other", i.e. the wrapped provider for every model', () => {
    const provider = new UserLocationGridProvider(datacenter);
    expect(provider.userLocation()).toBe('other');
    expect(provider.intensityFor(usHosted)).toBe(datacenter.intensityFor(usHosted));
    expect(provider.intensityFor(euHosted)).toBe(datacenter.intensityFor(euHosted));
  });

  it('charges a French user the French mix only for models hosted in Europe', () => {
    const provider = new UserLocationGridProvider(datacenter, 'fr');
    expect(provider.intensityFor(euHosted)).toBe(FRENCH_GRID_INTENSITY);
    // The decision that matters: a US-hosted model is still drawing US
    // electricity whoever is asking, so the French mix must NOT apply.
    expect(provider.intensityFor(usHosted)).toBe(datacenter.intensityFor(usHosted));
  });

  it('switches rule when the location changes at runtime', () => {
    const provider = new UserLocationGridProvider(datacenter);
    expect(provider.intensityFor(euHosted)).toBe(290);

    provider.setUserLocation('fr');
    expect(provider.intensityFor(euHosted)).toBe(FRENCH_GRID_INTENSITY);

    provider.setUserLocation('other');
    expect(provider.intensityFor(euHosted)).toBe(290);
  });
});
