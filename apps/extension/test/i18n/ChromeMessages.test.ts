import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChromeMessages } from '../../src/i18n/ChromeMessages.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ChromeMessages', () => {
  it('delegates to chrome.i18n.getMessage with the given substitutions', () => {
    const getMessage = vi.fn().mockReturnValue('Émissions : 12 mg.');
    vi.stubGlobal('chrome', { i18n: { getMessage } });

    const messages = new ChromeMessages();
    const result = messages.get('badgeAriaLabel', ['12', 'mg']);

    expect(result).toBe('Émissions : 12 mg.');
    expect(getMessage).toHaveBeenCalledWith('badgeAriaLabel', ['12', 'mg']);
  });

  it('falls back to the key itself when the catalog has no entry', () => {
    vi.stubGlobal('chrome', { i18n: { getMessage: vi.fn().mockReturnValue('') } });

    const messages = new ChromeMessages();
    expect(messages.get('someMissingKey')).toBe('someMissingKey');
  });
});
