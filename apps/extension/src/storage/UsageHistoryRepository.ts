/**
 * Tracks total gCO2e per calendar day, across every conversation and
 * provider - the cross-conversation ledger the dashboard's "last 30 days"
 * figure is summed from. Deliberately separate from ConversationRepository:
 * that one is about a single conversation's running total and reset
 * semantics, this one is about a rolling window across all of them.
 */
export interface UsageHistoryRepository {
  record(gCO2e: number, on?: Date): Promise<void>;
  totalForLastDays(days: number, now?: Date): Promise<number>;
}
