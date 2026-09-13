import type { FallbackHint } from '@carbometre/core';
import type { RawResponse } from './SiteAdapter.js';
import { TranscriptAdapter } from './TranscriptAdapter.js';

/**
 * Every chat.mistral.ai ("Le Chat") selector in one place, per the
 * project's fragile-selector policy.
 *
 * Verified against the live site on 2026-09-13: conversationContainer,
 * turn, authorRoleAttribute and its user/assistant values, and the
 * /work/<uuid> URL shape. Note that unlike ChatGPT, the role attribute sits
 * on the turn element itself rather than on a child - which is why text
 * lookups here go through selfOrDescendant().
 *
 * Not verified: no button on the page carries a model name (the only
 * candidate is a speed mode, "Fast"), so detectModelId() is expected to
 * return null here for now and fallbackModel() carries the estimate -
 * counted, but marked confidence: 'guessed'.
 */
export const MISTRAL_SELECTORS = {
  conversationContainer: '[data-testid="conversation-layout"]',
  // Deliberately excludes [data-message-author-role]: on this site it sits
  // on the very same element as data-message-id, and on the other two it
  // sits inside the turn - either way it adds no turn this doesn't already
  // match, and over-matching risks counting one reply twice.
  turnCandidates: ['[data-message-id]'],
  authorRoleHolder: '[data-message-author-role]',
  authorRoleAttribute: 'data-message-author-role',
  assistantRoleValue: 'assistant',
  userMessageText: '[data-message-author-role="user"]',
  assistantMessageText: '[data-message-author-role="assistant"]',
  // Narrower body containers, tried before falling back to the whole turn:
  // the turn also holds action buttons and timestamps, whose text would
  // otherwise inflate the token count. `.select-text` is what Le Chat wraps
  // message text in; the other two are there in case that changes.
  messageBodyCandidates: ['.select-text', '.prose', '.markdown'],
  modelPickerCandidates: [
    '[data-testid="model-selector"]',
    '[data-testid^="model"]',
    'button[aria-label*="model" i]',
  ],
} as const;

/** A model label is a short string like "Mistral Large", never a paragraph. */
const MAX_MODEL_LABEL_LENGTH = 40;

// Order matters: first match wins. "Ministral" and the "small" tier are
// checked before the broader Mistral patterns, since "Ministral 3B" would
// otherwise also match the plain /mistral/ pattern.
const MODEL_LABEL_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ministral|\bsmall\b|\bnemo\b/i, 'mistral-small'],
  [/magistral|\blarge\b/i, 'mistral-frontier'],
  [/mistral|\bmedium\b|le chat/i, 'mistral-mid'],
];

export class MistralAdapter extends TranscriptAdapter {
  readonly hostPatterns = ['chat.mistral.ai', 'mistral.ai'];
  readonly providerId = 'mistral';
  protected readonly containerSelector = MISTRAL_SELECTORS.conversationContainer;
  // Joined into one selector list so an unknown-but-present convention still
  // matches; TranscriptAdapter only needs "something that identifies a turn".
  protected readonly turnSelector = MISTRAL_SELECTORS.turnCandidates.join(', ');

  detectModelId(): string | null {
    for (const selector of MISTRAL_SELECTORS.modelPickerCandidates) {
      const modelId = this.classifyLabel(this.doc.querySelector(selector)?.textContent ?? '');
      if (modelId) {
        return modelId;
      }
    }
    for (const button of this.doc.querySelectorAll('button')) {
      const label = button.textContent?.trim() ?? '';
      if (label.length === 0 || label.length > MAX_MODEL_LABEL_LENGTH) {
        continue;
      }
      const modelId = this.classifyLabel(label);
      if (modelId) {
        return modelId;
      }
    }
    return null;
  }

  fallbackModel(): FallbackHint {
    // Mistral's flagship sits below the catalog's 200B "frontier" threshold,
    // so mid is both the safe and the likely-correct default here.
    return { providerId: 'mistral', tier: 'mid' };
  }

  currentConversationId(): string | null {
    const pathname = this.doc.defaultView?.location.pathname ?? '';
    // Confirmed live: conversations live at /work/<uuid>, not /chat/<id>.
    // Matching the uuid anywhere in the path rather than pinning the prefix,
    // since "work" is one of several sections Le Chat routes through and
    // guessing prefixes is exactly what cost us time on the other adapters.
    return /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(pathname)?.[1] ?? null;
  }

  protected isAssistantTurn(turn: Element): boolean {
    const roleHolder = this.selfOrDescendant(turn, MISTRAL_SELECTORS.authorRoleHolder);
    const role = roleHolder?.getAttribute(MISTRAL_SELECTORS.authorRoleAttribute);
    return role ? role === MISTRAL_SELECTORS.assistantRoleValue : this.isAssistantByAlternation(turn);
  }

  protected extractExchange(assistantTurn: Element): RawResponse | null {
    const promptTurn = this.precedingUserTurn(assistantTurn);
    const promptText = promptTurn ? this.messageText(promptTurn, MISTRAL_SELECTORS.userMessageText) : '';
    if (!promptText) {
      return null;
    }

    const responseText = this.messageText(assistantTurn, MISTRAL_SELECTORS.assistantMessageText);
    if (!responseText) {
      return null;
    }

    return { promptText, responseText };
  }

  /**
   * The message's own text, preferring a narrow body container over the
   * whole turn so that action-button labels and timestamps inside the turn
   * don't get counted as part of the message.
   */
  private messageText(turn: Element, roleSelector: string): string {
    const roleHolder = this.selfOrDescendant(turn, roleSelector);
    if (!roleHolder) {
      return '';
    }
    for (const bodySelector of MISTRAL_SELECTORS.messageBodyCandidates) {
      const body = roleHolder.querySelector(bodySelector);
      if (body) {
        return body.textContent?.trim() ?? '';
      }
    }
    return roleHolder.textContent?.trim() ?? '';
  }

  private classifyLabel(label: string): string | null {
    for (const [pattern, modelId] of MODEL_LABEL_PATTERNS) {
      if (pattern.test(label)) {
        return modelId;
      }
    }
    return null;
  }
}
