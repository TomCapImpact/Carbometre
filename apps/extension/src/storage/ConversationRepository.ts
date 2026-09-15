import type { Conversation } from '@carbometre/core';

/**
 * Persists per-conversation running totals - never message content (see
 * "Storage and privacy" in the build prompt). Behind an interface so the
 * backing store (chrome.storage.local today) can change without touching
 * any caller.
 */
export interface ConversationRepository {
  load(id: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
  /** Every stored conversation, for export. Order is not significant. */
  all(): Promise<readonly Conversation[]>;
  /** Forgets every conversation. Used by the Options page's "erase all data". */
  clear(): Promise<void>;
}
