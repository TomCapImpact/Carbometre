import { describe, expect, it } from 'vitest';
import frCatalog from '../../_locales/fr/messages.json' with { type: 'json' };
import { CatalogMessages, type MessageCatalog } from '../../src/i18n/CatalogMessages.js';
import { resolveMessages } from '../../src/i18n/resolveMessages.js';

const fr = frCatalog as MessageCatalog;

describe('CatalogMessages', () => {
  it('returns the message text, and the key itself for an unknown key (like chrome.i18n falling back)', () => {
    const messages = new CatalogMessages(fr);
    expect(messages.get('dashboardResetLabel')).toBe('Réinitialiser');
    expect(messages.get('noSuchKey')).toBe('noSuchKey');
  });

  it('substitutes $NAME$ placeholders by their $n index, like chrome.i18n', () => {
    const messages = new CatalogMessages(fr);
    expect(messages.get('dashboardSinceLabel', ['15 sept. 2026'])).toBe('Depuis le 15 sept. 2026');

    const several = new CatalogMessages({
      pair: {
        message: '$FIRST$ then $SECOND$, and $FIRST$ again',
        placeholders: { first: { content: '$1' }, second: { content: '$2' } },
      },
    });
    expect(several.get('pair', ['a', 'b'])).toBe('a then b, and a again');
  });

  it('leaves a placeholder empty when no substitution is given rather than printing $AMOUNT$', () => {
    expect(new CatalogMessages(fr).get('dashboardSinceLabel')).toBe('Depuis le ');
  });
});

describe('resolveMessages', () => {
  it('forces the chosen catalogue, so a French UI is available on an English browser and vice versa', () => {
    expect(resolveMessages('fr').get('dashboardResetLabel')).toBe('Réinitialiser');
    expect(resolveMessages('en').get('dashboardResetLabel')).toBe('Reset');
  });
});
