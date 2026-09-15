/** A running total across every conversation, and the moment it started counting. */
export interface CumulativeUsage {
  readonly gCO2e: number;
  readonly since: Date;
}

/**
 * Tracks gCO2e across every conversation and provider - the cross-
 * conversation figures the dashboard shows. Deliberately separate from
 * ConversationRepository: that one is about a single conversation's running
 * total, this one is about all of them together.
 *
 * Three views of the same recordings:
 *  - `cumulative()`: everything since the user last pressed reset. The
 *    dashboard's headline figure.
 *  - `allTime()`: everything since the extension was installed. Reset never
 *    touches it - it exists so a reset is not a way to lose the answer to
 *    "how much, in total?".
 *  - `totalSince()` / `totalForLastDays()`: sums over a calendar-day ledger,
 *    for "this month" and the export feature of the Options page. Reset
 *    does not touch the ledger either.
 */
/** Everything the history holds, for export. */
export interface UsageHistorySnapshot {
  /** gCO2e per UTC calendar day, keyed YYYY-MM-DD. */
  readonly daily: Readonly<Record<string, number>>;
  readonly cumulative: CumulativeUsage;
  readonly allTime: CumulativeUsage;
}

export interface UsageHistoryRepository {
  record(gCO2e: number, on?: Date): Promise<void>;
  snapshot(now?: Date): Promise<UsageHistorySnapshot>;
  /** Forgets everything: ledger and both counters. */
  clear(): Promise<void>;
  totalForLastDays(days: number, now?: Date): Promise<number>;
  /** Sum of the daily ledger from the calendar day containing `start` (UTC), inclusive. */
  totalSince(start: Date): Promise<number>;
  cumulative(now?: Date): Promise<CumulativeUsage>;
  allTime(now?: Date): Promise<CumulativeUsage>;
  reset(now?: Date): Promise<void>;
}
