import type { Unsubscribe } from '../types.js';

/** One finished exchange: the user's visible prompt and the assistant's visible reply. */
export interface RawResponse {
  readonly promptText: string;
  readonly responseText: string;
  /** Claude extended thinking or similar, only when the provider shows it inline with the reply. */
  readonly visibleThinkingText?: string;
}

/**
 * One class per supported site. Adding a fourth site is a new subclass plus
 * one line in AdapterRegistry - never a change here or in any other adapter.
 *
 * `doc` is injected (default: the live `document`) so adapters are testable
 * against a jsdom fixture without touching the real page.
 */
export abstract class SiteAdapter {
  abstract readonly hostPatterns: readonly string[];
  abstract readonly providerId: string;

  constructor(protected readonly doc: Document = document) {}

  /** Starts watching for finished assistant messages; call the returned function to stop. */
  abstract observeResponses(onResponse: (response: RawResponse) => void): Unsubscribe;

  /** A catalog model id (e.g. "claude-frontier"), or null if the model picker can't be read. */
  abstract detectModelId(): string | null;

  /** A stable per-conversation id, or null when no conversation is open (e.g. the site's home screen). */
  abstract currentConversationId(): string | null;

  /** Where the badge is injected, immediately before this element. Null if the header isn't ready yet. */
  abstract badgeAnchor(): HTMLElement | null;
}
