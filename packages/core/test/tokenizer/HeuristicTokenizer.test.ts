import { describe, expect, it } from 'vitest';
import { CHARS_PER_TOKEN, HeuristicTokenizer } from '../../src/tokenizer/HeuristicTokenizer.js';

describe('HeuristicTokenizer', () => {
  const tokenizer = new HeuristicTokenizer();

  it('returns 0 for empty or whitespace-only text', () => {
    expect(tokenizer.countTokens('', 'en')).toBe(0);
    expect(tokenizer.countTokens('   \n  ', 'fr')).toBe(0);
  });

  it('falls back to the given language when the sample is too short to detect', () => {
    // "Hi" has too few words for stopword-ratio detection to be conclusive.
    const chars = 'Hi'.length;
    expect(tokenizer.countTokens('Hi', 'en')).toBe(Math.ceil(chars / CHARS_PER_TOKEN.en));
    expect(tokenizer.countTokens('Hi', 'fr')).toBe(Math.ceil(chars / CHARS_PER_TOKEN.fr));
  });

  it('detects French from stopword density regardless of the fallback language', () => {
    const text = "Le chat est sur la table et il regarde les oiseaux dans le jardin avec attention.";
    const expected = Math.ceil(text.length / CHARS_PER_TOKEN.fr);
    expect(tokenizer.countTokens(text, 'en')).toBe(expected);
  });

  it('detects English from stopword density regardless of the fallback language', () => {
    const text = "The cat is on the table and it is watching the birds in the garden with attention.";
    const expected = Math.ceil(text.length / CHARS_PER_TOKEN.en);
    expect(tokenizer.countTokens(text, 'fr')).toBe(expected);
  });

  it('uses the fallback language when stopword scores tie', () => {
    // Long enough to pass the word-count threshold, but built only from words
    // that are not in either stopword list, so fr/en scores tie at zero.
    const text = 'ordinateur clavier souris ecran ordinateur clavier souris ecran ordinateur clavier';
    const expectedFr = Math.ceil(text.length / CHARS_PER_TOKEN.fr);
    const expectedEn = Math.ceil(text.length / CHARS_PER_TOKEN.en);
    expect(tokenizer.countTokens(text, 'fr')).toBe(expectedFr);
    expect(tokenizer.countTokens(text, 'en')).toBe(expectedEn);
  });

  it('rounds up to a whole number of tokens', () => {
    // 'x' repeated is a single long "word" (< 8 words -> detection inconclusive),
    // so this exercises the fallback path with an exact, predictable length.
    const text = 'x'.repeat(2001);
    expect(tokenizer.countTokens(text, 'en')).toBe(Math.ceil(2001 / CHARS_PER_TOKEN.en));
  });
});
