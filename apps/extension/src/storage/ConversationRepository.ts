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
}
