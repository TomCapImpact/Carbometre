import type { Messages } from './Messages.js';

/** The shape of one _locales/<lang>/messages.json entry. */
export interface CatalogEntry {
  readonly message: string;
  readonly placeholders?: Readonly<Record<string, { readonly content: string }>>;
}

export type MessageCatalog = Readonly<Record<string, CatalogEntry>>;

/**
 * Resolves messages from a catalogue bundled into the script, for the
 * manual language override: chrome.i18n only ever follows the browser's
 * own language and cannot be pointed at another catalogue. Implements the
 * same placeholder convention as chrome.i18n - "$NAME$" in the message,
 * `placeholders.name.content` = "$1" - so the JSON files need no second
 * format.
 */
export class CatalogMessages implements Messages {
  constructor(private readonly catalog: MessageCatalog) {}

  get(key: string, substitutions: string[] = []): string {
    const entry = this.catalog[key];
    if (!entry) {
      return key;
    }
    let text = entry.message;
    for (const [name, placeholder] of Object.entries(entry.placeholders ?? {})) {
      const index = Number.parseInt(placeholder.content.replace('$', ''), 10) - 1;
      const value = substitutions[index] ?? '';
      text = text.split(`$${name.toUpperCase()}$`).join(value);
    }
    return text;
  }
}
