import { type RawResponse, SiteAdapter } from './SiteAdapter.js';

/**
 * Every claude.ai selector in one place, per the project's fragile-selector
 * policy (carbometre-claude-code-prompt.md, "Site adapters").
 *
 * Verified against the live site on 2026-09-12: conversationContainer,
 * turn, turnRoleAttribute/assistantTurnRoleValue, turnStreamingAttribute,
 * humanMessageText, assistantMessageText, modelPicker and shareButton all
 * match real claude.ai markup. There is no separate "..." overflow menu in
 * the current UI - Share is the rightmost header control, so the badge
 * anchors immediately before it instead. thinkingBlock is still a
 * best-effort guess (no extended-thinking response was available to
 * inspect) - see detectModelId()/badgeAnchor() for the structural
 * fallbacks that cover a selector being or becoming wrong.
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
  shareButton: '[data-testid="wiggle-controls-actions-share"]',
} as const;

/** How long a message node must go untouched before we treat it as fully streamed. */
const STABLE_DELAY_MS = 800;

const MODEL_LABEL_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/opus/i, 'claude-frontier'],
  [/sonnet/i, 'claude-mid'],
  [/haiku/i, 'claude-small'],
];

export class ClaudeAdapter extends SiteAdapter {
  readonly hostPatterns = ['claude.ai'];
  readonly providerId = 'claude';

  observeResponses(onResponse: (response: RawResponse) => void): () => void {
    const container = this.findConversationContainer();
    if (!container) {
      return () => {};
    }

    const processed = new WeakSet<Element>();
    const pendingTimers = new Map<Element, ReturnType<typeof setTimeout>>();

    const scheduleCheck = (turn: Element): void => {
      if (processed.has(turn) || !this.isAssistantTurn(turn)) {
        return;
      }
      const existing = pendingTimers.get(turn);
      if (existing !== undefined) {
        clearTimeout(existing);
      }
      pendingTimers.set(
        turn,
        setTimeout(() => {
          pendingTimers.delete(turn);
          if (processed.has(turn) || !turn.isConnected) {
            return;
          }
          if (turn.getAttribute(CLAUDE_SELECTORS.turnStreamingAttribute) === 'true') {
            // Content paused for 800ms but the site still says it's
            // streaming (e.g. a tool-use pause) - wait for the next quiet
            // period instead of counting a partial response.
            scheduleCheck(turn);
            return;
          }
          const exchange = this.extractExchange(turn);
          if (exchange) {
            processed.add(turn);
            onResponse(exchange);
          }
        }, STABLE_DELAY_MS),
      );
    };

    // Only mutations observed from here on are counted - anything already in
    // the DOM when we attach is assumed already reflected in the stored
    // total, so re-scanning it would double-count (see Conversation/badge
    // reset rules in the build prompt).
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const turn = this.closestTurn(mutation.target);
        if (turn) {
          scheduleCheck(turn);
        }
      }
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      for (const timer of pendingTimers.values()) {
        clearTimeout(timer);
      }
    };
  }

  detectModelId(): string | null {
    const label = this.doc.querySelector(CLAUDE_SELECTORS.modelPicker)?.textContent ?? '';
    for (const [pattern, modelId] of MODEL_LABEL_PATTERNS) {
      if (pattern.test(label)) {
        return modelId;
      }
    }
    return null;
  }

  currentConversationId(): string | null {
    const pathname = this.doc.defaultView?.location.pathname ?? '';
    return /\/chat\/([a-z0-9-]+)/i.exec(pathname)?.[1] ?? null;
  }

  badgeAnchor(): HTMLElement | null {
    return this.doc.querySelector<HTMLElement>(CLAUDE_SELECTORS.shareButton);
  }

  private findConversationContainer(): Element | null {
    return this.doc.querySelector(CLAUDE_SELECTORS.conversationContainer) ?? this.doc.querySelector('main');
  }

  private closestTurn(target: Node): Element | null {
    // nodeType is a plain data property (1 = ELEMENT_NODE), so this stays
    // correct even if `target` belongs to a different window/realm than this
    // module's ambient globals - unlike `instanceof Element`, which does not.
    const element = target.nodeType === 1 ? (target as Element) : target.parentElement;
    return element?.closest(CLAUDE_SELECTORS.turn) ?? null;
  }

  private isAssistantTurn(turn: Element): boolean {
    const role = turn.getAttribute(CLAUDE_SELECTORS.turnRoleAttribute);
    if (role) {
      return role === CLAUDE_SELECTORS.assistantTurnRoleValue;
    }
    // Structural fallback: turns alternate human/assistant starting with a
    // human message, so assistant turns fall on the odd (0-based) positions.
    const turns = Array.from(turn.parentElement?.children ?? []).filter((el) => el.matches(CLAUDE_SELECTORS.turn));
    return turns.indexOf(turn) % 2 === 1;
  }

  private previousTurn(turn: Element): Element | null {
    let sibling = turn.previousElementSibling;
    while (sibling) {
      if (sibling.matches(CLAUDE_SELECTORS.turn)) {
        return sibling;
      }
      sibling = sibling.previousElementSibling;
    }
    return null;
  }

  private extractExchange(assistantTurn: Element): RawResponse | null {
    const promptTurn = this.previousTurn(assistantTurn);
    const promptText = promptTurn?.querySelector(CLAUDE_SELECTORS.humanMessageText)?.textContent?.trim() ?? '';
    if (!promptText) {
      return null;
    }

    // The reply's own container excludes the row's screen-reader-only
    // duplicate heading and the "N minutes ago" timestamp, so no cleanup
    // (unlike the earlier whole-row textContent approach) is needed here.
    const responseText = assistantTurn.querySelector(CLAUDE_SELECTORS.assistantMessageText)?.textContent?.trim() ?? '';
    if (!responseText) {
      return null;
    }

    const visibleThinkingText = assistantTurn.querySelector(CLAUDE_SELECTORS.thinkingBlock)?.textContent?.trim() || undefined;

    return visibleThinkingText ? { promptText, responseText, visibleThinkingText } : { promptText, responseText };
  }
}
