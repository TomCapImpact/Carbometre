import { describe, expect, it } from 'vitest';
import { TokenUsage } from '../../src/domain/TokenUsage.js';

describe('TokenUsage', () => {
  it('exposes the counts it was built with', () => {
    const usage = new TokenUsage(10, 20, 5);
    expect(usage.tokensIn).toBe(10);
    expect(usage.tokensOut).toBe(20);
    expect(usage.thinkingTokens).toBe(5);
  });

  it('defaults thinkingTokens to zero', () => {
    const usage = new TokenUsage(10, 20);
    expect(usage.thinkingTokens).toBe(0);
  });

  it('folds thinking tokens into effectiveOutputTokens', () => {
    const usage = new TokenUsage(10, 20, 8);
    expect(usage.effectiveOutputTokens).toBe(28);
  });

  it('rejects negative counts', () => {
    expect(() => new TokenUsage(-1, 0, 0)).toThrow(RangeError);
    expect(() => new TokenUsage(0, -1, 0)).toThrow(RangeError);
    expect(() => new TokenUsage(0, 0, -1)).toThrow(RangeError);
  });

  it('is immutable', () => {
    const usage = new TokenUsage(1, 2, 3);
    expect(() => {
      // @ts-expect-error readonly at the type level too; verifying the runtime freeze
      usage.tokensIn = 99;
    }).toThrow();
  });

  it('sums two usages field by field', () => {
    const a = new TokenUsage(10, 20, 5);
    const b = new TokenUsage(1, 2, 3);
    const sum = a.plus(b);
    expect(sum.tokensIn).toBe(11);
    expect(sum.tokensOut).toBe(22);
    expect(sum.thinkingTokens).toBe(8);
  });

  it('zero() is the additive identity', () => {
    const usage = new TokenUsage(10, 20, 5);
    expect(usage.plus(TokenUsage.zero())).toEqual(usage);
  });
});
