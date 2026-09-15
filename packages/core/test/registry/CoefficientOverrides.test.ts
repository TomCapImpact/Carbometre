import { describe, expect, it } from 'vitest';
import { ModelProfile, type ModelProfileProps } from '../../src/domain/ModelProfile.js';
import { isEditableCoefficient, isValidCoefficientValue } from '../../src/registry/CoefficientOverrides.js';
import { ModelRegistry } from '../../src/registry/ModelRegistry.js';

const BASE: ModelProfileProps = {
  id: 'claude-frontier',
  label: 'Claude frontier',
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

describe('isValidCoefficientValue', () => {
  it('enforces each coefficient\'s lower bound and rejects non-numbers', () => {
    expect(isValidCoefficientValue('pue', 1)).toBe(true);
    expect(isValidCoefficientValue('pue', 0.9)).toBe(false);
    expect(isValidCoefficientValue('eTokenWh', 0)).toBe(false);
    expect(isValidCoefficientValue('eTokenWh', 1e-9)).toBe(true);
    expect(isValidCoefficientValue('embodiedPerTokenG', 0)).toBe(true);
    expect(isValidCoefficientValue('uncertaintyFactor', 0.5)).toBe(false);
    expect(isValidCoefficientValue('hiddenThinkingMultiplier', Number.NaN)).toBe(false);
    expect(isValidCoefficientValue('hiddenThinkingMultiplier', '2')).toBe(false);
  });

  it('knows which keys are editable', () => {
    expect(isEditableCoefficient('pue')).toBe(true);
    expect(isEditableCoefficient('regionId')).toBe(false);
  });
});

describe('ModelRegistry overrides', () => {
  it('applies a user override on resolve, leaving the catalogue defaults untouched', () => {
    const registry = ModelRegistry.fromCatalog([BASE]);
    registry.setOverrides({ 'claude-frontier': { pue: 1.2, eTokenWh: 1e-4 } });

    const resolved = registry.resolve('claude-frontier');
    expect(resolved.pue).toBe(1.2);
    expect(resolved.eTokenWh).toBe(1e-4);
    expect(resolved.uncertaintyFactor).toBe(3.0); // untouched
    expect(registry.defaults()[0]?.pue).toBe(1.54);
  });

  it('also applies to the tier fallback, and keeps the guessed confidence', () => {
    const registry = ModelRegistry.fromCatalog([BASE]);
    registry.setOverrides({ 'claude-frontier': { pue: 1.2 } });
    const resolved = registry.resolve('claude-unknown', { providerId: 'claude', tier: 'frontier' });
    expect(resolved.pue).toBe(1.2);
    expect(resolved.confidence).toBe('guessed');
  });

  it('ignores unknown models, unknown keys and invalid values instead of failing', () => {
    const registry = ModelRegistry.fromCatalog([BASE]);
    registry.setOverrides({
      'no-such-model': { pue: 2 },
      'claude-frontier': { pue: 0.5, regionId: 'fr', eTokenWh: 2e-4 } as never,
    });
    const resolved = registry.resolve('claude-frontier');
    expect(resolved.pue).toBe(1.54);
    expect(resolved.regionId).toBe('us-average');
    expect(resolved.eTokenWh).toBe(2e-4);
  });

  it('setOverrides replaces the previous set', () => {
    const registry = ModelRegistry.fromCatalog([BASE]);
    registry.setOverrides({ 'claude-frontier': { pue: 1.2 } });
    registry.setOverrides({});
    expect(registry.resolve('claude-frontier').pue).toBe(1.54);
  });
});
