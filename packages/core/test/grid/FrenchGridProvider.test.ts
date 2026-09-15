import { describe, expect, it } from 'vitest';
import { ModelProfile, type ModelProfileProps } from '../../src/domain/ModelProfile.js';
import { DatacenterGridProvider } from '../../src/grid/DatacenterGridProvider.js';
import { FrenchGridProvider, FRENCH_GRID_INTENSITY } from '../../src/grid/FrenchGridProvider.js';

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

describe('FrenchGridProvider', () => {
  it('always returns the French grid mix, regardless of the model region', () => {
    const provider = new FrenchGridProvider();
    expect(provider.intensityFor(new ModelProfile({ ...BASE_PROPS, regionId: 'us-average' }))).toBe(
      FRENCH_GRID_INTENSITY,
    );
    expect(provider.intensityFor(new ModelProfile({ ...BASE_PROPS, regionId: 'eu-west' }))).toBe(
      FRENCH_GRID_INTENSITY,
    );
  });

  it('is the same number as the "fr" entry of regions.json (it drifted apart once: 60 vs 30)', () => {
    const viaTable = new DatacenterGridProvider().intensityFor(new ModelProfile({ ...BASE_PROPS, regionId: 'fr' }));
    expect(FRENCH_GRID_INTENSITY).toBe(viaTable);
    expect(FRENCH_GRID_INTENSITY).toBe(30);
  });
});
