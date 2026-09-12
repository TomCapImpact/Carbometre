import type { SupportedLanguage } from '@carbometre/core';

/**
 * Used only as the tokenizer's fallback language (see CarbometerService) -
 * never to pick which message catalog is shown, which chrome.i18n resolves
 * on its own from the browser's own language list.
 */
export function resolveUiLanguage(uiLanguage: string = chrome.i18n.getUILanguage()): SupportedLanguage {
  return uiLanguage.slice(0, 2).toLowerCase() === 'fr' ? 'fr' : 'en';
}
