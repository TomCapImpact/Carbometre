import { describe, expect, it } from 'vitest';
import { ModelProfile, type ModelProfileProps } from '../../src/domain/ModelProfile.js';
import { DatacenterGridProvider } from '../../src/grid/DatacenterGridProvider.js';
import { FrenchGridProvider, FRENCH_GRID_INTENSITY } from '../../src/grid/FrenchGridProvider.js';
import { GridReferenceProvider } from '../../src/grid/GridReferenceProvider.js';
import { isGridReference } from '../../src/grid/GridReference.js';
import { UserLocationGridProvider } from '../../src/grid/UserLocationGridProvider.js';

const BASE: ModelProfileProps = {
  id: 'm',
  label: 'm',
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
const usHosted = new ModelProfile(BASE);
const euHosted = new ModelProfile({ ...BASE, regionId: 'eu-west' });

function build(): { provider: GridReferenceProvider; datacenter: UserLocationGridProvider } {
  const datacenter = new UserLocationGridProvider(new DatacenterGridProvider());
  return { provider: new GridReferenceProvider(datacenter, new FrenchGridProvider()), datacenter };
}

describe('GridReferenceProvider', () => {
  it('defaults to the datacentre reference', () => {
    const { provider } = build();
    expect(provider.gridReference()).toBe('datacenter');
    expect(provider.intensityFor(usHosted)).toBe(370);
  });

  it('charges everything at the French mix in comparison mode, US-hosted models included', () => {
    const { provider } = build();
    provider.setReference('french-mix');
    expect(provider.intensityFor(usHosted)).toBe(FRENCH_GRID_INTENSITY);
    expect(provider.intensityFor(euHosted)).toBe(FRENCH_GRID_INTENSITY);
    provider.setReference('datacenter');
    expect(provider.intensityFor(usHosted)).toBe(370);
  });

  it('forwards the user location to the datacentre branch', () => {
    const { provider, datacenter } = build();
    provider.setUserLocation('fr');
    expect(datacenter.userLocation()).toBe('fr');
    expect(provider.intensityFor(euHosted)).toBe(FRENCH_GRID_INTENSITY);
    expect(provider.intensityFor(usHosted)).toBe(370);
  });
});

describe('isGridReference', () => {
  it('accepts the two references and nothing else', () => {
    expect(isGridReference('datacenter')).toBe(true);
    expect(isGridReference('french-mix')).toBe(true);
    expect(isGridReference('market-based')).toBe(false);
  });
});
