import { describe, expect, it } from 'vitest';
import { formatDistance, usesMiles } from '../../src/ui/formatDistance.js';

describe('usesMiles', () => {
  it('is true only for en-US', () => {
    expect(usesMiles('en-US')).toBe(true);
    expect(usesMiles('en-GB')).toBe(false);
    expect(usesMiles('fr-FR')).toBe(false);
    expect(usesMiles('fr')).toBe(false);
  });
});

describe('formatDistance', () => {
  it('keeps kilometres for a non-en-US locale', () => {
    const result = formatDistance(10, 'fr-FR');
    expect(result.unit).toBe('km');
    expect(result.amount).toBe('10');
  });

  it('converts kilometres to miles for en-US', () => {
    const result = formatDistance(1.609344, 'en-US');
    expect(result.unit).toBe('mi');
    expect(result.amount).toBe('1');
  });

  it('rounds to two significant figures', () => {
    expect(formatDistance(16.09344, 'en-US').amount).toBe('10'); // 10 miles
    expect(formatDistance(123, 'fr-FR').amount).toBe('120');
  });

  it('is zero for zero distance', () => {
    expect(formatDistance(0, 'fr-FR').amount).toBe('0');
  });
});
