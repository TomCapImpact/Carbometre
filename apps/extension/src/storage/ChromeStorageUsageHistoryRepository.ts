import type { CumulativeUsage, UsageHistoryRepository, UsageHistorySnapshot } from './UsageHistoryRepository.js';

const LEDGER_KEY = 'carbometre:dailyUsage';
const CUMULATIVE_KEY = 'carbometre:cumulative';
const ALL_TIME_KEY = 'carbometre:allTime';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Keep a bit more than any window v1 asks for, so storage never grows unbounded. */
const RETENTION_DAYS = 60;

type Ledger = Record<string, number>;

interface StoredCounter {
  readonly since: string;
  readonly gCO2e: number;
}

/** UTC calendar-day key (YYYY-MM-DD) - avoids local-timezone/DST edge cases for a tool that only needs day-level granularity. */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function dayStart(key: string): number {
  return new Date(`${key}T00:00:00Z`).getTime();
}

export class ChromeStorageUsageHistoryRepository implements UsageHistoryRepository {
  constructor(private readonly storageArea: chrome.storage.StorageArea = chrome.storage.local) {}

  async record(gCO2e: number, on: Date = new Date()): Promise<void> {
    // Counters first: while unseeded they are derived from the ledger,
    // which must not yet include this recording.
    const fresh: StoredCounter = { since: on.toISOString(), gCO2e: 0 };
    const cumulative = (await this.readCounter(CUMULATIVE_KEY)) ?? fresh;
    const allTime = (await this.readCounter(ALL_TIME_KEY)) ?? fresh;
    const ledger = await this.readLedger();
    const key = dateKey(on);
    ledger[key] = (ledger[key] ?? 0) + gCO2e;

    await this.storageArea.set({
      [LEDGER_KEY]: this.prune(ledger, on),
      [CUMULATIVE_KEY]: { since: cumulative.since, gCO2e: cumulative.gCO2e + gCO2e },
      [ALL_TIME_KEY]: { since: allTime.since, gCO2e: allTime.gCO2e + gCO2e },
    });
  }

  async totalForLastDays(days: number, now: Date = new Date()): Promise<number> {
    return this.totalSince(new Date(startOfUtcDay(now) - (days - 1) * DAY_MS));
  }

  async totalSince(start: Date): Promise<number> {
    const ledger = await this.readLedger();
    const cutoff = startOfUtcDay(start);
    let total = 0;
    for (const [key, value] of Object.entries(ledger)) {
      if (dayStart(key) >= cutoff) {
        total += value;
      }
    }
    return total;
  }

  async cumulative(now: Date = new Date()): Promise<CumulativeUsage> {
    return this.toUsage(await this.readCounter(CUMULATIVE_KEY), now);
  }

  async allTime(now: Date = new Date()): Promise<CumulativeUsage> {
    return this.toUsage(await this.readCounter(ALL_TIME_KEY), now);
  }

  async snapshot(now: Date = new Date()): Promise<UsageHistorySnapshot> {
    const [daily, cumulative, allTime] = await Promise.all([this.readLedger(), this.cumulative(now), this.allTime(now)]);
    return { daily: { ...daily }, cumulative, allTime };
  }

  async clear(): Promise<void> {
    await this.storageArea.remove([LEDGER_KEY, CUMULATIVE_KEY, ALL_TIME_KEY]);
  }

  async reset(now: Date = new Date()): Promise<void> {
    await this.storageArea.set({ [CUMULATIVE_KEY]: { since: now.toISOString(), gCO2e: 0 } });
  }

  private toUsage(stored: StoredCounter | null, now: Date): CumulativeUsage {
    return stored ? { gCO2e: stored.gCO2e, since: new Date(stored.since) } : { gCO2e: 0, since: now };
  }

  private async readLedger(): Promise<Ledger> {
    const result = (await this.storageArea.get(LEDGER_KEY)) as Record<string, Ledger | undefined>;
    return result[LEDGER_KEY] ?? {};
  }

  /**
   * A counter that is absent or unreadable is seeded from the daily ledger:
   * a user upgrading from a version that only had the ledger keeps what it
   * holds rather than restarting at zero, and a genuinely new user gets
   * null. The seed is persisted by the next record(), so this runs once.
   */
  private async readCounter(key: string): Promise<StoredCounter | null> {
    const result = (await this.storageArea.get(key)) as Record<string, StoredCounter | undefined>;
    const stored = result[key];
    if (stored && typeof stored.gCO2e === 'number' && !Number.isNaN(new Date(stored.since).getTime())) {
      return stored;
    }
    return this.fromLedger(await this.readLedger());
  }

  private fromLedger(ledger: Ledger): StoredCounter | null {
    const earliest = Object.keys(ledger).sort()[0];
    if (earliest === undefined) {
      return null;
    }
    const gCO2e = Object.values(ledger).reduce((sum, value) => sum + value, 0);
    return { gCO2e, since: new Date(dayStart(earliest)).toISOString() };
  }

  private prune(ledger: Ledger, now: Date): Ledger {
    const cutoff = startOfUtcDay(now) - RETENTION_DAYS * DAY_MS;
    const pruned: Ledger = {};
    for (const [key, value] of Object.entries(ledger)) {
      if (dayStart(key) >= cutoff) {
        pruned[key] = value;
      }
    }
    return pruned;
  }
}
