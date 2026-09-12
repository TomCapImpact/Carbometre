import type { UsageHistoryRepository } from './UsageHistoryRepository.js';

const STORAGE_KEY = 'carbometre:dailyUsage';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Keep a bit more than any window v1 asks for, so storage never grows unbounded. */
const RETENTION_DAYS = 60;

type Ledger = Record<string, number>;

/** UTC calendar-day key (YYYY-MM-DD) - avoids local-timezone/DST edge cases for a tool that only needs day-level granularity. */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export class ChromeStorageUsageHistoryRepository implements UsageHistoryRepository {
  constructor(private readonly storageArea: chrome.storage.StorageArea = chrome.storage.local) {}

  async record(gCO2e: number, on: Date = new Date()): Promise<void> {
    const ledger = await this.readLedger();
    const key = dateKey(on);
    ledger[key] = (ledger[key] ?? 0) + gCO2e;
    await this.storageArea.set({ [STORAGE_KEY]: this.prune(ledger, on) });
  }

  async totalForLastDays(days: number, now: Date = new Date()): Promise<number> {
    const ledger = await this.readLedger();
    const cutoff = startOfUtcDay(now) - (days - 1) * DAY_MS;
    let total = 0;
    for (const [key, value] of Object.entries(ledger)) {
      if (new Date(`${key}T00:00:00Z`).getTime() >= cutoff) {
        total += value;
      }
    }
    return total;
  }

  private async readLedger(): Promise<Ledger> {
    const result = (await this.storageArea.get(STORAGE_KEY)) as Record<string, Ledger | undefined>;
    return result[STORAGE_KEY] ?? {};
  }

  private prune(ledger: Ledger, now: Date): Ledger {
    const cutoff = startOfUtcDay(now) - RETENTION_DAYS * DAY_MS;
    const pruned: Ledger = {};
    for (const [key, value] of Object.entries(ledger)) {
      if (new Date(`${key}T00:00:00Z`).getTime() >= cutoff) {
        pruned[key] = value;
      }
    }
    return pruned;
  }
}
