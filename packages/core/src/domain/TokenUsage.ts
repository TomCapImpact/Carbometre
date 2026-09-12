/**
 * Immutable value object holding the token counts behind one estimate.
 *
 * `thinkingTokens` covers reasoning the user never sees: either the counted
 * length of a visible extended-thinking block, or a multiplier-based guess
 * when the provider hides its reasoning entirely. See ModelProfile.
 */
export class TokenUsage {
  constructor(
    readonly tokensIn: number,
    readonly tokensOut: number,
    readonly thinkingTokens: number = 0,
  ) {
    if (tokensIn < 0 || tokensOut < 0 || thinkingTokens < 0) {
      throw new RangeError('TokenUsage counts must not be negative');
    }
    Object.freeze(this);
  }

  /** Output tokens actually billed for emissions: visible output + reasoning. */
  get effectiveOutputTokens(): number {
    return this.tokensOut + this.thinkingTokens;
  }

  plus(other: TokenUsage): TokenUsage {
    return new TokenUsage(
      this.tokensIn + other.tokensIn,
      this.tokensOut + other.tokensOut,
      this.thinkingTokens + other.thinkingTokens,
    );
  }

  static zero(): TokenUsage {
    return new TokenUsage(0, 0, 0);
  }
}
