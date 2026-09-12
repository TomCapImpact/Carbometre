import { describe, expect, it } from 'vitest';
import { AVERAGE_CAR_GCO2E_PER_KM, gCO2eToCarKm } from '../../src/equivalence/CarEquivalence.js';

describe('gCO2eToCarKm', () => {
  it('converts using the documented average car factor', () => {
    expect(gCO2eToCarKm(AVERAGE_CAR_GCO2E_PER_KM)).toBeCloseTo(1, 10);
  });

  it('is zero for zero emissions', () => {
    expect(gCO2eToCarKm(0)).toBe(0);
  });

  it('scales linearly', () => {
    expect(gCO2eToCarKm(250)).toBeCloseTo(2, 10);
    expect(gCO2eToCarKm(62.5)).toBeCloseTo(0.5, 10);
  });
});
