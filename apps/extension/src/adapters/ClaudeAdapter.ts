import type { FallbackHint } from '@carbometre/core';
import type { RawResponse } from './SiteAdapter.js';
import { TranscriptAdapter } from './TranscriptAdapter.js';

/**
 * Every claude.ai selector in one place, per the project's fragile-selector
 * policy (carbometre-claude-code-prompt.md, "Site adapters").
 *
 * Verified against the live site on 2026-09-12: conversationContainer,
 * turn, turnRoleAttribute/assistantTurnRoleValue, turnStreamingAttribute,
 * humanMessageText, assistantMessageText and modelPicker all match real
 * claude.ai markup. thinkingBlock is still a best-effort guess (no
 * extended-thinking response was available to inspect) - detectModelId()
 * and isAssistantTurn() degrade rather than break if a selector drifts.
 */
export const CLAUDE_SELECTORS = {
  conversationContainer: '[data-testid="transcript-list"]',
  turn: '[data-testid="transcript-row"]',
  turnRoleAttribute: 'data-perf-row',
  assistantTurnRoleValue: 'assistant',
  turnStreamingAttribute: 'data-perf-row-streaming',
  humanMessageText: '[data-testid="user-message"]',
  assistantMessageText: '[data-perf-reply-text]',
  thinkingBlock: '[data-testid="thinking-block"], [data-testid="reasoning-block"]',
  modelPicker: '[data-testid="model-selector-dropdown"]',
} as const;

const MODEL_LABEL_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/opus/i, 'claude-frontier'],
  [/sonnet/i, 'claude-mid'],
  [/haiku/i, 'claude-small'],
];

export class ClaudeAdapter extends TranscriptAdapter {
  readonly hostPatterns = ['claude.ai'];
  readonly providerId = 'claude';
  protected readonly containerSelector = CLAUDE_SELECTORS.conversationContainer;
  protected readonly turnSelector = CLAUDE_SELECTORS.turn;

  detectModelId(): string | null {
    const label = this.doc.querySelector(CLAUDE_SELECTORS.modelPicker)?.textContent ?? '';
    for (const [pattern, modelId] of MODEL_LABEL_PATTERNS) {
      if (pattern.test(label)) {
        return modelId;
      }
    }
    return null;
  }

  fallbackModel(): FallbackHint {
    return { providerId: 'claude', tier: 'frontier' };
  }

  currentConversationId(): string | null {
    const pathname = this.doc.defaultView?.location.pathname ?? '';
    return /\/chat\/([a-z0-9-]+)/i.exec(pathname)?.[1] ?? null;
  }

  protected isAssistantTurn(turn: Element): boolean {
    const role = turn.getAttribute(CLAUDE_SELECTORS.turnRoleAttribute);
    return role ? role === CLAUDE_SELECTORS.assistantTurnRoleValue : this.isAssistantByAlternation(turn);
  }

  protected override isStillStreaming(turn: Element): boolean {
    // Claude publishes this per row, so a reply that pauses mid tool-call
    // isn't mistaken for a finished one just because it went quiet.
    return turn.getAttribute(CLAUDE_SELECTORS.turnStreamingAttribute) === 'true';
  }

  protected extractExchange(assistantTurn: Element): RawResponse | null {
    const promptTurn = this.precedingUserTurn(assistantTurn);
    const promptText = promptTurn
      ? (this.selfOrDescendant(promptTurn, CLAUDE_SELECTORS.humanMessageText)?.textContent?.trim() ?? '')
      : '';
    if (!promptText) {
      return null;
    }

    // The reply's own container excludes the row's screen-reader-only
    // duplicate heading and the "N minutes ago" timestamp, so no cleanup
    // (unlike a whole-row textContent read) is needed here.
    const responseText =
      this.selfOrDescendant(assistantTurn, CLAUDE_SELECTORS.assistantMessageText)?.textContent?.trim() ?? '';
    if (!responseText) {
      return null;
    }

    const visibleThinkingText =
      this.selfOrDescendant(assistantTurn, CLAUDE_SELECTORS.thinkingBlock)?.textContent?.trim() || undefined;

    return visibleThinkingText ? { promptText, responseText, visibleThinkingText } : { promptText, responseText };
  }
}
