import {
  DatacenterGridProvider,
  FrenchGridProvider,
  GridReferenceProvider,
  ModelProfile,
  type ModelProfileProps,
  ModelRegistry,
  UserLocationGridProvider,
} from '@carbometre/core';
import { describe, expect, it } from 'vitest';
import { CalculationSettingsApplier } from '../../src/calculation/CalculationSettingsApplier.js';
import { DEFAULT_SETTINGS } from '../../src/storage/ChromeStorageSettingsRepository.js';

const PROFILE: ModelProfileProps = {
  id: 'mistral-mid',
  label: 'Mistral',
  tier: 'mid',
  emissionModelId: 'token-based',
  eTokenWh: 2.0e-4,
  pue: 1.54,
  regionId: 'eu-west',
  regionConfidence: 'assumed',
  embodiedPerTokenG: 2.0e-5,
  hiddenThinkingMultiplier: 1.0,
  thinkingVisible: true,
  uncertaintyFactor: 3.0,
  confidence: 'modelled',
  sources: [],
};

describe('CalculationSettingsApplier', () => {
  it('routes grid reference, location and coefficient overrides to the objects that hold them', () => {
    const grid = new GridReferenceProvider(
      new UserLocationGridProvider(new DatacenterGridProvider()),
      new FrenchGridProvider(),
    );
    const models = ModelRegistry.fromCatalog([PROFILE]);
    const applier = new CalculationSettingsApplier(grid, models);
    const profile = new ModelProfile(PROFILE);

    applier.apply({ ...DEFAULT_SETTINGS, userLocation: 'fr', coefficientOverrides: { 'mistral-mid': { pue: 1.1 } } });
    expect(grid.intensityFor(profile)).toBe(30); // French user, EU-hosted model
    expect(models.resolve('mistral-mid').pue).toBe(1.1);

    applier.apply({ ...DEFAULT_SETTINGS, userLocation: null, gridReference: 'french-mix' });
    expect(grid.gridReference()).toBe('french-mix');
    expect(grid.intensityFor(profile)).toBe(30);
    expect(models.resolve('mistral-mid').pue).toBe(1.54); // overrides cleared

    applier.apply(DEFAULT_SETTINGS);
    expect(grid.intensityFor(profile)).toBe(290); // unanswered location = datacentre grid
  });
});
