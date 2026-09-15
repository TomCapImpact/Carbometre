import { describe, expect, it } from 'vitest';
import { AVERAGE_CAR_GCO2E_PER_KM } from '../../src/equivalence/CarEquivalence.js';
import { EQUIVALENCE_IDS, FixedFactorEquivalence, isEquivalenceId } from '../../src/equivalence/Equivalence.js';
import { EquivalenceCatalog, PLANE_GCO2E_PER_PASSENGER_KM } from '../../src/equivalence/EquivalenceCatalog.js';

describe('FixedFactorEquivalence', () => {
  it('divides by the factor', () => {
    expect(new FixedFactorEquivalence('car-km', 125).unitsFor(250)).toBeCloseTo(2, 10);
  });

  it('rejects a non-positive factor rather than producing Infinity on the dashboard', () => {
    expect(() => new FixedFactorEquivalence('car-km', 0)).toThrow();
    expect(() => new FixedFactorEquivalence('car-km', -1)).toThrow();
  });
});

describe('isEquivalenceId', () => {
  it('accepts every catalogued id and rejects anything else, including the retired one (settings come from storage, untyped)', () => {
    for (const id of EQUIVALENCE_IDS) {
      expect(isEquivalenceId(id)).toBe(true);
    }
    expect(isEquivalenceId('ac-hours')).toBe(false);
    expect(isEquivalenceId('miles')).toBe(false);
    expect(isEquivalenceId(undefined)).toBe(false);
  });
});

describe('EquivalenceCatalog', () => {
  const catalog = new EquivalenceCatalog();

  it('resolves car and plane to the documented factors', () => {
    expect(catalog.resolve('car-km').gCO2ePerUnit).toBe(AVERAGE_CAR_GCO2E_PER_KM);
    expect(catalog.resolve('plane-km').gCO2ePerUnit).toBe(PLANE_GCO2E_PER_PASSENGER_KM);
  });

  it('gives sensible magnitudes: 1 kg of CO2e is ~8 km by car, ~4 km by plane', () => {
    expect(catalog.resolve('car-km').unitsFor(1000)).toBeCloseTo(8, 0);
    expect(catalog.resolve('plane-km').unitsFor(1000)).toBeCloseTo(3.9, 1);
  });

  it('returns a fresh, independent object every time', () => {
    expect(catalog.resolve('car-km')).not.toBe(catalog.resolve('car-km'));
  });
});
