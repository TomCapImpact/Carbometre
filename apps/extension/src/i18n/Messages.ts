/**
 * Wraps the extension's string catalog. Kept as an interface (per the
 * project's dependency-inversion rule) so UI classes never call chrome.i18n
 * directly and can be unit-tested without a browser.
 */
export interface Messages {
  get(key: string, substitutions?: string[]): string;
}
