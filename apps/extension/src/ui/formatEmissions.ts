const EMISSIONS_FORMATTER = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Just the number, rounded to two decimals in the browser's own locale - no unit. */
export function formatEmissionsNumber(gCO2e: number): string {
  return EMISSIONS_FORMATTER.format(gCO2e);
}

/**
 * Formats a gCO2e amount for display: always grams, rounded to two
 * decimals, decimal separator from the browser's own locale (not tied to the
 * fr/en interface language - a user in any locale sees their own
 * convention, e.g. "0,12 gCO2e" in French vs "0.12 gCO2e" in English).
 */
export function formatEmissions(gCO2e: number): string {
  return `${formatEmissionsNumber(gCO2e)} gCO2e`;
}

/** A low-high range, e.g. "0,0 – 0,9 gCO2e" - one trailing unit, not one per bound. */
export function formatEmissionsRange(gCO2eLow: number, gCO2eHigh: number): string {
  return `${formatEmissionsNumber(gCO2eLow)} – ${formatEmissionsNumber(gCO2eHigh)} gCO2e`;
}
