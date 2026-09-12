import { describe, expect, it } from 'vitest';
import { CarbometerService } from '../src/CarbometerService.js';
import type { ModelProfileProps } from '../src/domain/ModelProfile.js';
import { EmissionModelRegistry } from '../src/emissions/EmissionModelRegistry.js';
import { TokenBasedEmissionModel } from '../src/emissions/TokenBasedEmissionModel.js';
import { DatacenterGridProvider } from '../src/grid/DatacenterGridProvider.js';
import { ModelRegistry } from '../src/registry/ModelRegistry.js';
import catalog from '../src/registry/models.json' with { type: 'json' };
import { HeuristicTokenizer } from '../src/tokenizer/HeuristicTokenizer.js';

/**
 * Wires the real production catalog and the v1-default DatacenterGridProvider -
 * i.e. this is the composition root the extension itself will build.
 */
function buildService(): CarbometerService {
  const tokenizer = new HeuristicTokenizer();
  const models = ModelRegistry.fromCatalog(catalog as unknown as ModelProfileProps[]);
  const emissions = new EmissionModelRegistry().register(
    'token-based',
    new TokenBasedEmissionModel(new DatacenterGridProvider()),
  );
  return new CarbometerService(tokenizer, models, emissions);
}

// Single-character repeats keep the heuristic tokenizer's language detection
// inconclusive (too few "words"), so it falls back to the given `lang` and
// yields an exact, predictable token count: length / CHARS_PER_TOKEN[lang].
const PROMPT_200_CHARS = 'y'.repeat(200); // -> 50 tokens in English (4.0 chars/token)
const RESPONSE_2000_CHARS = 'x'.repeat(2000); // -> 500 tokens in English

describe('CarbometerService golden values', () => {
  it('estimates a 500-token Claude frontier response near 0.12-0.13 gCO2e', () => {
    const service = buildService();

    const estimate = service.estimate({
      modelId: 'claude-frontier',
      promptText: PROMPT_200_CHARS,
      responseText: RESPONSE_2000_CHARS,
      lang: 'en',
    });

    expect(estimate.usage.tokensIn).toBe(50);
    expect(estimate.usage.tokensOut).toBe(500);
    // Pinned exact value: (500*5e-4 + 50*5e-4*0.05)*1.12*370/1000 + (500+2.5)*4.9e-5.
    // If this fails after a coefficient change, update the expected value deliberately.
    expect(estimate.gCO2e).toBeCloseTo(0.1287405, 6);
    expect(estimate.confidence).toBe('modelled');
  });

  it('estimates a 500-token Mistral response near 0.04 gCO2e', () => {
    const service = buildService();

    const estimate = service.estimate({
      modelId: 'mistral-mid',
      promptText: PROMPT_200_CHARS,
      responseText: RESPONSE_2000_CHARS,
      lang: 'en',
    });

    expect(estimate.usage.tokensIn).toBe(50);
    expect(estimate.usage.tokensOut).toBe(500);
    // Pinned exact value: (500*2e-4 + 50*2e-4*0.05)*1.12*290/1000 + (500+2.5)*2.0e-5.
    expect(estimate.gCO2e).toBeCloseTo(0.0426924, 6);
  });

  it('counts visible Claude extended-thinking text as extra output tokens', () => {
    const service = buildService();

    const withoutThinking = service.estimate({
      modelId: 'claude-frontier',
      promptText: PROMPT_200_CHARS,
      responseText: RESPONSE_2000_CHARS,
      lang: 'en',
    });
    const withThinking = service.estimate({
      modelId: 'claude-frontier',
      promptText: PROMPT_200_CHARS,
      responseText: RESPONSE_2000_CHARS,
      visibleThinkingText: 'z'.repeat(4000), // +1000 tokens
      lang: 'en',
    });

    expect(withThinking.usage.thinkingTokens).toBe(1000);
    expect(withThinking.gCO2e).toBeGreaterThan(withoutThinking.gCO2e);
  });

  it('multiplies output tokens for a model with hidden, unseen reasoning', () => {
    const service = buildService();

    // gpt-frontier: thinkingVisible false, hiddenThinkingMultiplier 4.0
    const estimate = service.estimate({
      modelId: 'gpt-frontier',
      promptText: PROMPT_200_CHARS,
      responseText: RESPONSE_2000_CHARS,
      lang: 'en',
    });

    // effectiveOutputTokens = 500 visible + 500*(4.0-1) hidden = 2000
    expect(estimate.usage.thinkingTokens).toBe(1500);
    expect(estimate.usage.effectiveOutputTokens).toBe(2000);
  });

  it('falls back to a tier default, marked as guessed, for a model outside the catalog', () => {
    const service = buildService();

    const estimate = service.estimate({
      modelId: 'claude-4-mystery-snapshot',
      promptText: PROMPT_200_CHARS,
      responseText: RESPONSE_2000_CHARS,
      lang: 'en',
      fallback: { providerId: 'claude', tier: 'frontier' },
    });

    expect(estimate.confidence).toBe('guessed');
  });

  it('rejects a model with no catalog entry and no fallback', () => {
    const service = buildService();
    expect(() =>
      service.estimate({
        modelId: 'totally-unknown',
        promptText: '',
        responseText: '',
      }),
    ).toThrow(/totally-unknown/);
  });
});
