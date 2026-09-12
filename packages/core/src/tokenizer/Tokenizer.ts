export type SupportedLanguage = 'fr' | 'en';

/**
 * Counts tokens in a piece of visible text. `lang` is the fallback language
 * to use when the implementation cannot confidently detect one from the
 * text itself (e.g. a very short message) - callers pass the active UI
 * locale here, per METHODOLOGY.md.
 */
export interface Tokenizer {
  countTokens(text: string, lang: SupportedLanguage): number;
}
