import type { FallbackHint } from '@carbometre/core';
import type { RawResponse } from './SiteAdapter.js';
import { TranscriptAdapter } from './TranscriptAdapter.js';

/**
 * Every chatgpt.com selector in one place, per the project's fragile-
 * selector policy (carbometre-claude-code-prompt.md, "Site adapters").
 *
 * Verified against the live site on 2026-09-13: turn, authorRoleHolder /
 * authorRoleAttribute, userMessageText and assistantMessageText all match.
 * Two things this site taught us the hard way, both now handled in
 * TranscriptAdapter: turn elements are not DOM siblings of each other, and
 * one logical reply can span several consecutive assistant turns.
 *
 * modelPickerCandidates is still unconfirmed - hence a list plus the
 * label-scan fallback in detectModelId() rather than one guess.
 */
export const CHATGPT_SELECTORS = {
  conversationContainer: 'main',
  turn: '[data-testid^="conversation-turn-"]',
  authorRoleHolder: '[data-message-author-role]',
  authorRoleAttribute: 'data-message-author-role',
  assistantRoleValue: 'assistant',
  userMessageText: '[data-message-author-role="user"]',
  assistantMessageText: '[data-message-author-role="assistant"]',
  // Prefer this narrower one when present: the role holder itself may also
  // wrap action buttons (copy, regenerate...), which .markdown excludes.
  assistantMessageTextPreferred: '[data-message-author-role="assistant"] .markdown',
  modelPickerCandidates: [
    '[data-testid="model-switcher-dropdown-button"]',
    '[data-testid^="model-switcher"]',
    'button[aria-label*="model" i]',
  ],
} as const;

/** A model label is a short string like "GPT-5 Thinking", never a paragraph. */
const MAX_MODEL_LABEL_LENGTH = 40;

// Order matters: checked top to bottom, first match wins. "mini"/"nano" must
// be excluded before the broader frontier/mid checks, since a label like
// "GPT-5 mini" would otherwise also match the plain "gpt" pattern.
const MODEL_LABEL_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/mini|nano/i, 'gpt-small'],
  [/\bpro\b|\bthinking\b|\bo3\b|\bo1\b/i, 'gpt-frontier'],
  [/gpt|chatgpt/i, 'gpt-mid'],
];

export class ChatGptAdapter extends TranscriptAdapter {
  readonly hostPatterns = ['chatgpt.com', 'chat.openai.com'];
  readonly providerId = 'chatgpt';
  protected readonly containerSelector = CHATGPT_SELECTORS.conversationContainer;
  protected readonly turnSelector = CHATGPT_SELECTORS.turn;

  detectModelId(): string | null {
    for (const selector of CHATGPT_SELECTORS.modelPickerCandidates) {
      const modelId = this.classifyLabel(this.doc.querySelector(selector)?.textContent ?? '');
      if (modelId) {
        return modelId;
      }
    }
    // Last resort: the picker is a button whose whole label is a model name,
    // so scan short button labels for one we can classify. Length-capped to
    // avoid matching prose that happens to contain "GPT".
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
    // Catalog ids are "gpt-*", not "chatgpt-*". Mid tier is the conservative
    // middle choice when we genuinely can't read which model is selected.
    return { providerId: 'gpt', tier: 'mid' };
  }

  currentConversationId(): string | null {
    const pathname = this.doc.defaultView?.location.pathname ?? '';
    // Confirmed live on 2026-09-13: conversation URLs are /c/<id>, and
    // briefly /uc/<id> right after a new chat is created.
    return /\/u?c\/([a-z0-9-]+)/i.exec(pathname)?.[1] ?? null;
  }

  protected isAssistantTurn(turn: Element): boolean {
    const roleHolder = this.selfOrDescendant(turn, CHATGPT_SELECTORS.authorRoleHolder);
    const role = roleHolder?.getAttribute(CHATGPT_SELECTORS.authorRoleAttribute);
    return role ? role === CHATGPT_SELECTORS.assistantRoleValue : this.isAssistantByAlternation(turn);
  }

  protected extractExchange(assistantTurn: Element): RawResponse | null {
    const promptTurn = this.precedingUserTurn(assistantTurn);
    const promptText = promptTurn
      ? (this.selfOrDescendant(promptTurn, CHATGPT_SELECTORS.userMessageText)?.textContent?.trim() ?? '')
      : '';
    if (!promptText) {
      return null;
    }

    const responseEl =
      this.selfOrDescendant(assistantTurn, CHATGPT_SELECTORS.assistantMessageTextPreferred) ??
      this.selfOrDescendant(assistantTurn, CHATGPT_SELECTORS.assistantMessageText);
    const responseText = responseEl?.textContent?.trim() ?? '';
    if (!responseText) {
      return null;
    }

    return { promptText, responseText };
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
