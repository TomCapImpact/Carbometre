import { describe, expect, it } from 'vitest';
import { ModelProfile, type ModelProfileProps } from '../../src/domain/ModelProfile.js';
import { ModelRegistry } from '../../src/registry/ModelRegistry.js';

function profile(overrides: Partial<ModelProfileProps> = {}): ModelProfile {
  return new ModelProfile({
    id: 'claude-mid',
    label: 'Claude (modèle intermédiaire)',
    tier: 'mid',
    emissionModelId: 'token-based',
    eTokenWh: 2.0e-4,
    pue: 1.12,
    regionId: 'us-average',
    regionConfidence: 'assumed',
    embodiedPerTokenG: 2.0e-5,
    hiddenThinkingMultiplier: 1.0,
    thinkingVisible: true,
    uncertaintyFactor: 3.0,
    confidence: 'modelled',
    sources: [],
    ...overrides,
  });
}

describe('ModelRegistry', () => {
  it('resolves an exact id without touching confidence', () => {
    const registry = new ModelRegistry().register(profile());
    const resolved = registry.resolve('claude-mid');
    expect(resolved.id).toBe('claude-mid');
    expect(resolved.confidence).toBe('modelled');
  });

  it('falls back to the "{providerId}-{tier}" generic profile for an unknown model, marked as guessed', () => {
    const frontier = profile({ id: 'claude-frontier', tier: 'frontier', eTokenWh: 5.0e-4 });
    const registry = new ModelRegistry().register(frontier);

    const resolved = registry.resolve('claude-4-mystery-snapshot', { providerId: 'claude', tier: 'frontier' });

    expect(resolved.id).toBe('claude-frontier');
    expect(resolved.confidence).toBe('guessed');
    // every other coefficient carries over untouched from the fallback profile
    expect(resolved.eTokenWh).toBe(frontier.eTokenWh);
  });

  it('throws when the model is unknown and no fallback is provided', () => {
    const registry = new ModelRegistry().register(profile());
    expect(() => registry.resolve('does-not-exist')).toThrow(/does-not-exist/);
  });

  it('throws when the model is unknown and the fallback tier is not registered either', () => {
    const registry = new ModelRegistry().register(profile({ id: 'claude-mid' }));
    expect(() => registry.resolve('unknown-model', { providerId: 'claude', tier: 'small' })).toThrow();
  });

  it('has() reflects only exact registrations', () => {
    const registry = new ModelRegistry().register(profile());
    expect(registry.has('claude-mid')).toBe(true);
    expect(registry.has('claude-frontier')).toBe(false);
  });

  it('fromCatalog registers every entry by id', () => {
    const catalog: ModelProfileProps[] = [
      {
        id: 'a',
        label: 'A',
        tier: 'small',
        emissionModelId: 'token-based',
        eTokenWh: 1e-4,
        pue: 1,
        regionId: 'fr',
        regionConfidence: 'assumed',
        embodiedPerTokenG: 1e-5,
        hiddenThinkingMultiplier: 1,
        thinkingVisible: true,
        uncertaintyFactor: 2,
        confidence: 'modelled',
        sources: [],
      },
      {
        id: 'b',
        label: 'B',
        tier: 'mid',
        emissionModelId: 'token-based',
        eTokenWh: 2e-4,
        pue: 1.1,
        regionId: 'eu-west',
        regionConfidence: 'assumed',
        embodiedPerTokenG: 2e-5,
        hiddenThinkingMultiplier: 1,
        thinkingVisible: false,
        uncertaintyFactor: 3,
        confidence: 'modelled',
        sources: [],
      },
    ];

    const registry = ModelRegistry.fromCatalog(catalog);

    expect(registry.has('a')).toBe(true);
    expect(registry.has('b')).toBe(true);
    expect(registry.resolve('b').tier).toBe('mid');
  });
});
