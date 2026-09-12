import { describe, expect, it } from 'vitest';
import { formatEmissions, formatEmissionsRange } from '../../src/ui/formatEmissions.js';

describe('formatEmissions', () => {
  it('always shows grams, rounded to one decimal', () => {
    expect(formatEmissions(1.2874)).toBe('1.3 gCO2e');
    expect(formatEmissions(12.345)).toBe('12.3 gCO2e');
    expect(formatEmissions(3)).toBe('3.0 gCO2e');
  });

  it('shows zero as 0.0, not blank or a sudden unit switch', () => {
    expect(formatEmissions(0)).toBe('0.0 gCO2e');
  });

  it('rounds a very small amount down to 0.0 rather than switching to milligrams', () => {
    // A deliberate simplification: sub-0.05 gCO2e amounts are indistinguishable
    // from zero on the badge. Accepted trade-off for a single "x.x gCO2e" format.
    expect(formatEmissions(0.0426924)).toBe('0.0 gCO2e');
  });
});

describe('formatEmissionsRange', () => {
  it('formats both bounds with a single trailing unit', () => {
    expect(formatEmissionsRange(0.043, 0.386)).toBe('0.0 – 0.4 gCO2e');
  });

  it('handles a zero-to-something range', () => {
    expect(formatEmissionsRange(0, 1.5)).toBe('0.0 – 1.5 gCO2e');
  });
});
