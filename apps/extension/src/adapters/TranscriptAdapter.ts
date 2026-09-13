import { type RawResponse, SiteAdapter } from './SiteAdapter.js';
import type { Unsubscribe } from '../types.js';

/** How long a message node must go untouched before we treat it as fully streamed. */
const STABLE_DELAY_MS = 800;

/**
 * Shared machinery for "a chat transcript made of turn elements", which is
 * how all three supported sites are built. Subclasses supply the selectors
 * and the two site-specific judgement calls (which turns are the
 * assistant's, and how to pull text out of one); everything below is the
 * part that was independently rediscovered - and independently broken - in
 * each adapter before this was extracted.
 *
 * Two hard-won rules live here so no future adapter has to relearn them:
 *
 * - Turn elements are related by *document order*, never by DOM sibling
 *   links. Confirmed on chatgpt.com, where each turn sits in its own
 *   wrapper and `previousElementSibling` reaches nothing.
 * - A finished reply is detected by the turn going quiet for
 *   STABLE_DELAY_MS, and only mutations seen after attaching are counted -
 *   rescanning what was already on the page would double-count history.
 */
export abstract class TranscriptAdapter extends SiteAdapter {
  /** Scope for the MutationObserver; falls back to <main> when absent. */
  protected abstract readonly containerSelector: string;
  /** Matches one turn element (one message, or one sub-step of a reply). */
  protected abstract readonly turnSelector: string;

  protected abstract isAssistantTurn(turn: Element): boolean;
  protected abstract extractExchange(assistantTurn: Element): RawResponse | null;

  /**
   * Lets a site that publishes a "still streaming" flag veto a turn that has
   * merely gone quiet - e.g. a pause mid tool-call. Sites without such a
   * signal rely on the quiet period alone.
   */
  protected isStillStreaming(_turn: Element): boolean {
    return false;
  }

  observeResponses(onResponse: (response: RawResponse) => void): Unsubscribe {
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
          if (this.isStillStreaming(turn)) {
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

  /** Every turn on the page, in document order, however deeply each is nested. */
  protected allTurnsInDocumentOrder(): Element[] {
    return Array.from(this.doc.querySelectorAll(this.turnSelector));
  }

  /**
   * Like querySelector, but also matches `root` itself. Needed because a
   * turn element sometimes *is* the thing being looked for (the role holder,
   * the message body) rather than containing it, and a descendant-only
   * lookup silently finds nothing in that case.
   */
  protected selfOrDescendant(root: Element, selector: string): Element | null {
    return root.matches(selector) ? root : root.querySelector(selector);
  }

  /**
   * The nearest preceding turn that isn't the assistant's - i.e. the prompt
   * this reply answers. Skips intermediate assistant turns, since one reply
   * can render as several (a reasoning/tool step, then the answer).
   */
  protected precedingUserTurn(turn: Element): Element | null {
    const turns = this.allTurnsInDocumentOrder();
    for (let i = turns.indexOf(turn) - 1; i >= 0; i--) {
      const candidate = turns[i]!;
      if (!this.isAssistantTurn(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /** Position-based assistant guess for when a site's role markers disappear. */
  protected isAssistantByAlternation(turn: Element): boolean {
    // Transcripts start with a user message, so assistant turns land on the
    // odd (0-based) positions.
    return this.allTurnsInDocumentOrder().indexOf(turn) % 2 === 1;
  }

  private findConversationContainer(): Element | null {
    return this.doc.querySelector(this.containerSelector) ?? this.doc.querySelector('main');
  }

  private closestTurn(target: Node): Element | null {
    // nodeType is a plain data property (1 = ELEMENT_NODE), so this stays
    // correct even if `target` belongs to a different window/realm than this
    // module's ambient globals - unlike `instanceof Element`, which does not.
    const element = target.nodeType === 1 ? (target as Element) : target.parentElement;
    return element?.closest(this.turnSelector) ?? null;
  }
}
