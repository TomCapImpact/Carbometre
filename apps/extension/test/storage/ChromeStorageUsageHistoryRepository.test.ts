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
});
