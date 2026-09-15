import { describe, expect, it } from 'vitest';
import { formatQuantity } from '../../src/ui/formatQuantity.js';

describe('formatQuantity', () => {
  it('rounds to two significant figures', () => {
    expect(formatQuantity(123)).toBe('120');
    expect(formatQuantity(0.0336)).toBe('0.034');
    expect(formatQuantity(1.6)).toBe('1.6');
  });

  it('is zero for zero', () => {
    expect(formatQuantity(0)).toBe('0');
  });
});
