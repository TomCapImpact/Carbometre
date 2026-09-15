import { describe, expect, it, vi } from 'vitest';
import { ChromeStorageUsageHistoryRepository } from '../../src/storage/ChromeStorageUsageHistoryRepository.js';

function fakeStorageArea(): chrome.storage.StorageArea {
  const data = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => ({ [key]: data.get(key) })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
    }),
  } as unknown as chrome.storage.StorageArea;
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('ChromeStorageUsageHistoryRepository', () => {
  it('returns zero when nothing has ever been recorded', async () => {
    const repo = new ChromeStorageUsageHistoryRepository(fakeStorageArea());
    expect(await repo.totalForLastDays(30)).toBe(0);
  });

  it('sums multiple recordings on the same day', async () => {
    const repo = new ChromeStorageUsageHistoryRepository(fakeStorageArea());
    const today = new Date('2026-06-15T10:00:00Z');
    await repo.record(0.5, today);
    await repo.record(0.3, today);
    expect(await repo.totalForLastDays(30, today)).toBeCloseTo(0.8, 10);
  });

  it('includes entries within the window and excludes entries older than it', async () => {
    // A trailing 30-day window ending on 2026-06-15 (inclusive) starts on
    // 2026-05-17 - that's day 30 counting back from and including today.
    const repo = new ChromeStorageUsageHistoryRepository(fakeStorageArea());
    const today = new Date('2026-06-15T10:00:00Z');
    const firstDayStillInWindow = new Date('2026-05-17T00:00:00Z');
    const oneDayBeforeWindow = new Date('2026-05-16T00:00:00Z');
    const wayOutside = new Date('2026-04-01T00:00:00Z');

    await repo.record(1, firstDayStillInWindow);
    await repo.record(2, oneDayBeforeWindow);
    await repo.record(100, wayOutside);

    expect(await repo.totalForLastDays(30, today)).toBeCloseTo(1, 10);
  });

  it('a fresh repository instance reading the same storage area sees prior recordings (round-trips through storage, not memory)', async () => {
    const area = fakeStorageArea();
    const today = new Date('2026-06-15T10:00:00Z');
    await new ChromeStorageUsageHistoryRepository(area).record(0.7, today);

    const secondInstance = new ChromeStorageUsageHistoryRepository(area);
    expect(await secondInstance.totalForLastDays(30, today)).toBeCloseTo(0.7, 10);
  });

  it('prunes entries far outside any v1 window so storage does not grow forever', async () => {
    const area = fakeStorageArea();
    const today = new Date('2026-06-15T10:00:00Z');
    const veryOld = new Date(today.getTime() - 90 * DAY_MS);
    const repo = new ChromeStorageUsageHistoryRepository(area);

    await repo.record(5, veryOld);
    await repo.record(1, today);

    // Recording again forces a prune pass; a huge window should no longer see the very old entry.
    await repo.record(0, today);
    expect(await repo.totalForLastDays(36500, today)).toBeCloseTo(1, 10);
  });

  describe('cumulative()', () => {
    it('starts at zero "since now" for a fresh install', async () => {
      const repo = new ChromeStorageUsageHistoryRepository(fakeStorageArea());
      const now = new Date('2026-09-15T10:00:00Z');
      expect(await repo.cumulative(now)).toEqual({ gCO2e: 0, since: now });
    });

    it('sums every recording, across days, and dates "since" from the first one', async () => {
      const repo = new ChromeStorageUsageHistoryRepository(fakeStorageArea());
      const first = new Date('2026-09-01T09:00:00Z');
      await repo.record(1, first);
      await repo.record(2, new Date('2026-09-10T09:00:00Z'));

      const result = await repo.cumulative(new Date('2026-09-15T00:00:00Z'));
      expect(result.gCO2e).toBeCloseTo(3, 10);
      expect(result.since.toISOString()).toBe(first.toISOString());
    });

    it('is not capped by the ledger retention window (it is a counter, not a ledger)', async () => {
      const repo = new ChromeStorageUsageHistoryRepository(fakeStorageArea());
      const longAgo = new Date('2026-01-01T00:00:00Z');
      const today = new Date('2026-09-15T00:00:00Z');
      await repo.record(5, longAgo);
      await repo.record(1, today); // prunes the January ledger entry

      expect(await repo.totalForLastDays(36500, today)).toBeCloseTo(1, 10);
      expect((await repo.cumulative(today)).gCO2e).toBeCloseTo(6, 10);
    });

    it('seeds itself from a pre-existing daily ledger so an upgrade does not restart at zero', async () => {
      const area = fakeStorageArea();
      await area.set({ 'carbometre:dailyUsage': { '2026-09-03': 0.4, '2026-09-01': 0.6 } });
      const repo = new ChromeStorageUsageHistoryRepository(area);

      const result = await repo.cumulative(new Date('2026-09-15T00:00:00Z'));
      expect(result.gCO2e).toBeCloseTo(1, 10);
      expect(result.since.toISOString()).toBe('2026-09-01T00:00:00.000Z');

      await repo.record(1, new Date('2026-09-15T00:00:00Z'));
      expect((await repo.cumulative()).gCO2e).toBeCloseTo(2, 10);
    });
  });

  describe('allTime() and totalSince()', () => {
    it('allTime counts everything and is untouched by reset', async () => {
      const repo = new ChromeStorageUsageHistoryRepository(fakeStorageArea());
      const first = new Date('2026-08-20T09:00:00Z');
      await repo.record(2, first);
      await repo.reset(new Date('2026-09-01T00:00:00Z'));
      await repo.record(3, new Date('2026-09-10T09:00:00Z'));

      const allTime = await repo.allTime();
      expect(allTime.gCO2e).toBeCloseTo(5, 10);
      expect(allTime.since.toISOString()).toBe(first.toISOString());
      expect((await repo.cumulative()).gCO2e).toBeCloseTo(3, 10);
    });

    it('allTime seeds from a pre-existing ledger on upgrade, like cumulative', async () => {
      const area = fakeStorageArea();
      await area.set({ 'carbometre:dailyUsage': { '2026-09-03': 0.4, '2026-09-01': 0.6 } });
      const allTime = await new ChromeStorageUsageHistoryRepository(area).allTime();
      expect(allTime.gCO2e).toBeCloseTo(1, 10);
      expect(allTime.since.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    });

    it('totalSince sums whole UTC calendar days from the one containing the start', async () => {
      const repo = new ChromeStorageUsageHistoryRepository(fakeStorageArea());
      await repo.record(1, new Date('2026-08-31T23:30:00Z'));
      await repo.record(2, new Date('2026-09-01T00:10:00Z'));
      await repo.record(4, new Date('2026-09-14T12:00:00Z'));

      expect(await repo.totalSince(new Date('2026-09-01T00:00:00Z'))).toBeCloseTo(6, 10);
      expect(await repo.totalSince(new Date('2026-09-01T18:00:00Z'))).toBeCloseTo(6, 10); // same day counts
    });
  });

  describe('reset()', () => {
    it('zeroes the counter and restarts "since" at the reset moment, leaving the daily ledger intact', async () => {
      const repo = new ChromeStorageUsageHistoryRepository(fakeStorageArea());
      const today = new Date('2026-09-15T10:00:00Z');
      await repo.record(3, today);

      const resetAt = new Date('2026-09-15T12:00:00Z');
      await repo.reset(resetAt);

      expect(await repo.cumulative()).toEqual({ gCO2e: 0, since: resetAt });
      expect(await repo.totalForLastDays(30, today)).toBeCloseTo(3, 10);

      await repo.record(1, new Date('2026-09-15T13:00:00Z'));
      expect((await repo.cumulative()).gCO2e).toBeCloseTo(1, 10);
    });
  });
});
