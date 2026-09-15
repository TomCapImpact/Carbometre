/** 'auto' follows the browser (chrome.i18n); 'fr' / 'en' force a catalogue. */
export type UiLanguage = 'auto' | 'fr' | 'en';

export const UI_LANGUAGES: readonly UiLanguage[] = ['auto', 'fr', 'en'];

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'auto';

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === 'string' && (UI_LANGUAGES as readonly string[]).includes(value);
}
