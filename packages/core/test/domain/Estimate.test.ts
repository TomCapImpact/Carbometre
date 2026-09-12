import { describe, expect, it } from 'vitest';
import { Estimate } from '../../src/domain/Estimate.js';
import { TokenUsage } from '../../src/domain/TokenUsage.js';

describe('Estimate.fromEnergyBreakdown', () => {
  it('sums electricity and embodied into gCO2e', () => {
    const estimate = Estimate.fromEnergyBreakdown({
      usage: new TokenUsage(10, 100, 0),
      energyWh: 1,
      electricityG: 0.3,
      embodiedG: 0.05,
      uncertaintyFactor: 3,
      confidence: 'modelled',
    });
    expect(estimate.gCO2e).toBeCloseTo(0.35, 10);
  });

  it('derives the low/high range from the uncertainty factor', () => {
    const estimate = Estimate.fromEnergyBreakdown({
      usage: new TokenUsage(10, 100, 0),
      energyWh: 1,
      electricityG: 0.3,
      embodiedG: 0.0,
      uncertaintyFactor: 3,
      confidence: 'modelled',
    });
    expect(estimate.gCO2eLow).toBeCloseTo(0.1, 10);
    expect(estimate.gCO2eHigh).toBeCloseTo(0.9, 10);
  });
});

describe('Estimate.zero', () => {
  it('is all zeros with modelled confidence', () => {
    const zero = Estimate.zero();
    expect(zero.gCO2e).toBe(0);
    expect(zero.gCO2eLow).toBe(0);
    expect(zero.gCO2eHigh).toBe(0);
    expect(zero.energyWh).toBe(0);
    expect(zero.confidence).toBe('modelled');
  });
});

describe('Estimate.plus', () => {
  it('accumulates usage and every gram/Wh figure', () => {
    const a = Estimate.fromEnergyBreakdown({
      usage: new TokenUsage(10, 100, 0),
      energyWh: 1,
      electricityG: 0.3,
      embodiedG: 0.05,
      uncertaintyFactor: 3,
      confidence: 'modelled',
    });
    const b = Estimate.fromEnergyBreakdown({
      usage: new TokenUsage(5, 50, 2),
      energyWh: 0.5,
      electricityG: 0.15,
      embodiedG: 0.02,
      uncertaintyFactor: 3,
      confidence: 'modelled',
    });

    const total = a.plus(b);

    expect(total.usage).toEqual(new TokenUsage(15, 150, 2));
    expect(total.energyWh).toBeCloseTo(1.5, 10);
    expect(total.electricityG).toBeCloseTo(0.45, 10);
    expect(total.embodiedG).toBeCloseTo(0.07, 10);
    expect(total.gCO2e).toBeCloseTo(0.52, 10);
    expect(total.gCO2eLow).toBeCloseTo(a.gCO2eLow + b.gCO2eLow, 10);
    expect(total.gCO2eHigh).toBeCloseTo(a.gCO2eHigh + b.gCO2eHigh, 10);
  });

  it('keeps the running total at the worse of the two confidences', () => {
    const measured = Estimate.fromEnergyBreakdown({
      usage: TokenUsage.zero(),
      energyWh: 0,
      electricityG: 0,
      embodiedG: 0,
      uncertaintyFactor: 1,
      confidence: 'measured',
    });
    const guessed = Estimate.fromEnergyBreakdown({
      usage: TokenUsage.zero(),
      energyWh: 0,
      electricityG: 0,
      embodiedG: 0,
      uncertaintyFactor: 1,
      confidence: 'guessed',
    });

    expect(measured.plus(guessed).confidence).toBe('guessed');
    expect(guessed.plus(measured).confidence).toBe('guessed');
  });

  it('is left unaffected by mutating the estimates that produced it (immutability)', () => {
    const a = Estimate.zero();
    const b = Estimate.fromEnergyBreakdown({
      usage: new TokenUsage(1, 1, 0),
      energyWh: 1,
      electricityG: 1,
      embodiedG: 0,
      uncertaintyFactor: 2,
      confidence: 'modelled',
    });
    const total = a.plus(b);
    expect(() => {
      // @ts-expect-error verifying runtime freeze
      total.gCO2e = 999;
    }).toThrow();
  });
});
