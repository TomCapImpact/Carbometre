import type { ModelProfileProps } from '../domain/ModelProfile.js';

/** The per-model coefficients a user may edit from the Options page. */
export const EDITABLE_COEFFICIENTS = [
  'eTokenWh',
  'pue',
  'embodiedPerTokenG',
  'hiddenThinkingMultiplier',
  'uncertaintyFactor',
] as const satisfies readonly (keyof ModelProfileProps)[];

export type EditableCoefficient = (typeof EDITABLE_COEFFICIENTS)[number];

export function isEditableCoefficient(value: unknown): value is EditableCoefficient {
  return typeof value === 'string' && (EDITABLE_COEFFICIENTS as readonly string[]).includes(value);
}

/** Values that replace the catalogue's for one model. Absent keys keep the default. */
export type CoefficientOverride = Partial<Record<EditableCoefficient, number>>;

/** Keyed by model id. */
export type CoefficientOverrides = Readonly<Record<string, CoefficientOverride>>;

/**
 * Lower bounds that keep the formula meaningful: energy and embodied
 * footprint must be positive, PUE cannot be below 1 (a facility cannot
 * use less power than its servers), a multiplier of 1 means "no hidden
 * reasoning", and an uncertainty factor of 1 means "no range".
 */
export const COEFFICIENT_MINIMUMS: Readonly<Record<EditableCoefficient, number>> = {
  eTokenWh: Number.MIN_VALUE,
  pue: 1,
  embodiedPerTokenG: 0,
  hiddenThinkingMultiplier: 1,
  uncertaintyFactor: 1,
};

export function isValidCoefficientValue(coefficient: EditableCoefficient, value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= COEFFICIENT_MINIMUMS[coefficient];
}
