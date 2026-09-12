import type { Confidence } from './ModelProfile.js';
import { TokenUsage } from './TokenUsage.js';

const CONFIDENCE_RANK: Record<Confidence, number> = {
  measured: 0,
  modelled: 1,
  guessed: 2,
};

/** The less trustworthy of the two confidences, so accumulation never overstates certainty. */
function worseConfidence(a: Confidence, b: Confidence): Confidence {
  return CONFIDENCE_RANK[a] >= CONFIDENCE_RANK[b] ? a : b;
}

export interface EstimateFields {
  readonly usage: TokenUsage;
  readonly energyWh: number;
  readonly electricityG: number;
  readonly embodiedG: number;
  readonly gCO2eLow: number;
  readonly gCO2eHigh: number;
  readonly confidence: Confidence;
}

export interface EnergyBreakdown {
  readonly usage: TokenUsage;
  readonly energyWh: number;
  readonly electricityG: number;
  readonly embodiedG: number;
  readonly uncertaintyFactor: number;
  readonly confidence: Confidence;
}

/**
 * Immutable value object: the result of one emission calculation, or the
 * running sum of several (see `plus`).
 */
export class Estimate {
  readonly usage: TokenUsage;
  readonly energyWh: number;
  readonly gCO2e: number;
  readonly gCO2eLow: number;
  readonly gCO2eHigh: number;
  readonly electricityG: number;
  readonly embodiedG: number;
  readonly confidence: Confidence;

  constructor(fields: EstimateFields) {
    this.usage = fields.usage;
    this.energyWh = fields.energyWh;
    this.electricityG = fields.electricityG;
    this.embodiedG = fields.embodiedG;
    this.gCO2e = fields.electricityG + fields.embodiedG;
    this.gCO2eLow = fields.gCO2eLow;
    this.gCO2eHigh = fields.gCO2eHigh;
    this.confidence = fields.confidence;
    Object.freeze(this);
  }

  /** Builds an Estimate from a single model calculation, deriving the low/high range from `uncertaintyFactor`. */
  static fromEnergyBreakdown(breakdown: EnergyBreakdown): Estimate {
    const gCO2e = breakdown.electricityG + breakdown.embodiedG;
    return new Estimate({
      usage: breakdown.usage,
      energyWh: breakdown.energyWh,
      electricityG: breakdown.electricityG,
      embodiedG: breakdown.embodiedG,
      gCO2eLow: gCO2e / breakdown.uncertaintyFactor,
      gCO2eHigh: gCO2e * breakdown.uncertaintyFactor,
      confidence: breakdown.confidence,
    });
  }

  static zero(): Estimate {
    return new Estimate({
      usage: TokenUsage.zero(),
      energyWh: 0,
      electricityG: 0,
      embodiedG: 0,
      gCO2eLow: 0,
      gCO2eHigh: 0,
      confidence: 'modelled',
    });
  }

  /** Accumulates two estimates, e.g. adding a new response to a conversation's running total. */
  plus(other: Estimate): Estimate {
    return new Estimate({
      usage: this.usage.plus(other.usage),
      energyWh: this.energyWh + other.energyWh,
      electricityG: this.electricityG + other.electricityG,
      embodiedG: this.embodiedG + other.embodiedG,
      gCO2eLow: this.gCO2eLow + other.gCO2eLow,
      gCO2eHigh: this.gCO2eHigh + other.gCO2eHigh,
      confidence: worseConfidence(this.confidence, other.confidence),
    });
  }
}
