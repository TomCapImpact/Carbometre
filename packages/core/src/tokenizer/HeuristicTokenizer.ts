import type { SupportedLanguage, Tokenizer } from './Tokenizer.js';

/**
 * Average characters per token by language. French text runs shorter per
 * token than English on typical BPE tokenizers, hence the lower ratio.
 * A single table so adding a language never touches the class below.
 */
export const CHARS_PER_TOKEN: Readonly<Record<SupportedLanguage, number>> = {
  fr: 3.6,
  en: 4.0,
};

/**
 * Short, high-frequency function words used only to *distinguish* French
 * from English, never to understand the text. Cheap and good enough for a
 * ratio-based signal: real prose is dense with these; anything else is not.
 */
const STOPWORDS: Readonly<Record<SupportedLanguage, ReadonlySet<string>>> = {
  fr: new Set([
    'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'est', 'que',
    'qui', 'pour', 'dans', 'pas', 'ce', 'cette', 'ces', 'en', 'au', 'aux',
    'sur', 'avec', 'plus', 'mais', 'ou', 'se', 'sont', 'vous', 'nous', 'je',
  ]),
  en: new Set([
    'the', 'of', 'and', 'is', 'a', 'an', 'that', 'which', 'for', 'in', 'not',
    'this', 'these', 'on', 'at', 'to', 'with', 'as', 'are', 'be', 'you', 'we',
    'i', 'or', 'but', 'have', 'it',
  ]),
};

/** Minimum number of words before language detection is trusted at all. */
const MIN_WORDS_FOR_DETECTION = 8;

const WORD_PATTERN = /\p{L}+/gu;

/**
 * No official tokenizer exists for third-party LLMs from a browser
 * extension, so this approximates token count from character length. It
 * sits behind the Tokenizer interface purely so it can be swapped for a
 * real tokenizer later without touching any caller.
 */
export class HeuristicTokenizer implements Tokenizer {
  countTokens(text: string, lang: SupportedLanguage): number {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return 0;
    }

    const detected = this.detectLanguage(trimmed) ?? lang;
    const charsPerToken = CHARS_PER_TOKEN[detected];
    return Math.ceil(trimmed.length / charsPerToken);
  }

  /** Returns null when the sample is too short or too evenly split to call. */
  private detectLanguage(text: string): SupportedLanguage | null {
    const words = text.toLowerCase().match(WORD_PATTERN) ?? [];
    if (words.length < MIN_WORDS_FOR_DETECTION) {
      return null;
    }

    let frScore = 0;
    let enScore = 0;
    for (const word of words) {
      if (STOPWORDS.fr.has(word)) frScore += 1;
      if (STOPWORDS.en.has(word)) enScore += 1;
    }

    if (frScore === enScore) {
      return null;
    }
    return frScore > enScore ? 'fr' : 'en';
  }
}
