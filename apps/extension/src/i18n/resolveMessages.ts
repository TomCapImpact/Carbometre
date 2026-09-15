import en from '../../_locales/en/messages.json' with { type: 'json' };
import fr from '../../_locales/fr/messages.json' with { type: 'json' };
import { CatalogMessages, type MessageCatalog } from './CatalogMessages.js';
import { ChromeMessages } from './ChromeMessages.js';
import type { Messages } from './Messages.js';
import type { UiLanguage } from './UiLanguage.js';

/**
 * The one place that decides where strings come from: the browser's own
 * resolution unless the user forced a language in the Options page.
 * Both catalogues ride along in the bundle (a few kB) so the override
 * needs no fetch, not even of a bundled file.
 */
export function resolveMessages(language: UiLanguage): Messages {
  switch (language) {
    case 'fr':
      return new CatalogMessages(fr as MessageCatalog);
    case 'en':
      return new CatalogMessages(en as MessageCatalog);
    case 'auto':
      return new ChromeMessages();
  }
}
