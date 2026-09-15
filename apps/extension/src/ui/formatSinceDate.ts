/**
 * "Since <date>" for the dashboard's cumulative row, in the browser's own
 * locale convention (e.g. "15 sept. 2026" / "Sep 15, 2026"), consistent
 * with how numbers are formatted elsewhere in the UI.
 */
export function formatSinceDate(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}
