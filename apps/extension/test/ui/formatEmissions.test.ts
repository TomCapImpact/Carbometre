import { describe, expect, it } from 'vitest';
import { formatEmissions, formatEmissionsRange } from '../../src/ui/formatEmissions.js';

describe('formatEmissions', () => {
  it('always shows grams, rounded to two decimals', () => {
    expect(formatEmissions(1.2874)).toBe('1.29 gCO2e');
    expect(formatEmissions(12.345)).toBe('12.35 gCO2e');
    expect(formatEmissions(3)).toBe('3.00 gCO2e');
  });

  it('shows zero as 0.00, not blank or a sudden unit switch', () => {
    expect(formatEmissions(0)).toBe('0.00 gCO2e');
  });

  it('rounds a very small amount down to 0.00 rather than switching to milligrams', () => {
    // A deliberate simplification: sub-0.005 gCO2e amounts are indistinguishable
    // from zero on the badge. Accepted trade-off for a single "x.xx gCO2e" format.
    expect(formatEmissions(0.0034)).toBe('0.00 gCO2e');
  });
});

describe('formatEmissionsRange', () => {
  it('formats both bounds with a single trailing unit', () => {
    expect(formatEmissionsRange(0.043, 0.386)).toBe('0.04 – 0.39 gCO2e');
  });

  it('handles a zero-to-something range', () => {
    expect(formatEmissionsRange(0, 1.5)).toBe('0.00 – 1.50 gCO2e');
  });
});
