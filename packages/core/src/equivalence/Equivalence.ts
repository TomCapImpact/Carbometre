/**
 * The everyday comparisons the dashboard can express a total in. Ids are
 * persisted in the user's settings, so they must never be renamed.
 *
 * An "hours of air conditioning" option existed briefly and was removed:
 * its factor depended on the user's own grid, so a French user saw the
 * number of hours jump 15x when answering "France" - technically right,
 * but it read as "my emissions went up". Comparisons that depend on where
 * the user lives confuse more than they explain.
 */
export type EquivalenceId = 'car-km' | 'plane-km';

export const EQUIVALENCE_IDS: readonly EquivalenceId[] = ['car-km', 'plane-km'];

export const DEFAULT_EQUIVALENCE_ID: EquivalenceId = 'car-km';

export function isEquivalenceId(value: unknown): value is EquivalenceId {
  return typeof value === 'string' && (EQUIVALENCE_IDS as readonly string[]).includes(value);
}

/** Turns a gCO2e amount into a number of intuitive units (km, ...). */
export interface Equivalence {
  readonly id: EquivalenceId;
  /** gCO2e emitted per one unit of the comparison. */
  readonly gCO2ePerUnit: number;
  unitsFor(gCO2e: number): number;
}

export class FixedFactorEquivalence implements Equivalence {
  constructor(
    readonly id: EquivalenceId,
    readonly gCO2ePerUnit: number,
  ) {
    if (!(gCO2ePerUnit > 0)) {
      throw new Error(`Equivalence "${id}": gCO2ePerUnit must be positive, got ${gCO2ePerUnit}`);
    }
  }

  unitsFor(gCO2e: number): number {
    return gCO2e / this.gCO2ePerUnit;
  }
}
