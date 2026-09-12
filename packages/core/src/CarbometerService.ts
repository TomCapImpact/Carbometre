import { Estimate } from './domain/Estimate.js';
import type { ModelProfile } from './domain/ModelProfile.js';
import { TokenUsage } from './domain/TokenUsage.js';
import type { EmissionModelRegistry } from './emissions/EmissionModelRegistry.js';
import type { FallbackHint, ModelRegistry } from './registry/ModelRegistry.js';
import type { SupportedLanguage, Tokenizer } from './tokenizer/Tokenizer.js';

export interface EstimateInput {
  readonly modelId: string;
  readonly promptText: string;
  readonly responseText: string;
  /** Claude extended thinking blocks, when visible and enabled. */
  readonly visibleThinkingText?: string;
  readonly lang?: SupportedLanguage;
  /** Used only if `modelId` is not in the catalog; see ModelRegistry.resolve. */
  readonly fallback?: FallbackHint;
}

/**
 * Facade used by the extension: turns the visible text of one exchange into
 * an Estimate. Every dependency is injected, so swapping the tokenizer, the
 * catalog or the emission methodology never requires editing this class.
 */
export class CarbometerService {
  constructor(
    private readonly tokenizer: Tokenizer,
    private readonly models: ModelRegistry,
    private readonly emissions: EmissionModelRegistry,
  ) {}

  estimate(input: EstimateInput): Estimate {
    const lang = input.lang ?? 'en';
    const profile = this.models.resolve(input.modelId, input.fallback);

    const tokensIn = this.tokenizer.countTokens(input.promptText, lang);
    const tokensOut = this.tokenizer.countTokens(input.responseText, lang);
    const thinkingTokens = this.resolveThinkingTokens(profile, tokensOut, input.visibleThinkingText, lang);

    const usage = new TokenUsage(tokensIn, tokensOut, thinkingTokens);
    const emissionModel = this.emissions.resolve(profile.emissionModelId);
    return emissionModel.estimate(usage, profile);
  }

  private resolveThinkingTokens(
    profile: ModelProfile,
    tokensOut: number,
    visibleThinkingText: string | undefined,
    lang: SupportedLanguage,
  ): number {
    if (profile.thinkingVisible) {
      return visibleThinkingText ? this.tokenizer.countTokens(visibleThinkingText, lang) : 0;
    }
    return tokensOut * (profile.hiddenThinkingMultiplier - 1);
  }
}
