import type { Messages } from './Messages.js';

/** Reads from _locales/{en,fr}/messages.json via the extension platform's own i18n resolution. */
export class ChromeMessages implements Messages {
  get(key: string, substitutions?: string[]): string {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }
}
