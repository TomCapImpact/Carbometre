const QUANTITY_FORMATTER = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 2 });

/**
 * Formats an equivalence amount (km, hours) to two significant figures in
 * the browser's own locale. Always metric: the earlier km/miles switch on
 * en-US was dropped - one unit everywhere is easier to explain, and the
 * methodology page states its factors per kilometre.
 */
export function formatQuantity(amount: number): string {
  return QUANTITY_FORMATTER.format(amount);
}
