import { Conversation, Estimate, TokenUsage } from '@carbometre/core';
import { describe, expect, it, vi } from 'vitest';
import { ChromeStorageConversationRepository } from '../../src/storage/ChromeStorageConversationRepository.js';

function fakeStorageArea(): chrome.storage.StorageArea {
  const data = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string | null) =>
      key === null ? Object.fromEntries(data) : { [key]: data.get(key) },
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        data.delete(key);
      }
    }),
  } as unknown as chrome.storage.StorageArea;
}

describe('ChromeStorageConversationRepository', () => {
  it('returns null for a conversation that was never saved', async () => {
    const repository = new ChromeStorageConversationRepository(fakeStorageArea());
    expect(await repository.load('never-saved')).toBeNull();
  });

  it('round-trips a conversation through save and load without losing precision', async () => {
    const area = fakeStorageArea();
    const repository = new ChromeStorageConversationRepository(area);

    const total = Estimate.fromEnergyBreakdown({
      usage: new TokenUsage(50, 500, 10),
      energyWh: 0.2814,
      electricityG: 0.104118,
      embodiedG: 0.0246225,
      uncertaintyFactor: 3,
      confidence: 'modelled',
    });
    const conversation = new Conversation('conv-1', 'claude', total, 2);

    await repository.save(conversation);
    const loaded = await repository.load('conv-1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('conv-1');
    expect(loaded!.providerId).toBe('claude');
    expect(loaded!.responseCount).toBe(2);
    expect(loaded!.total.usage).toEqual(total.usage);
    expect(loaded!.total.gCO2e).toBeCloseTo(total.gCO2e, 10);
    expect(loaded!.total.gCO2eLow).toBeCloseTo(total.gCO2eLow, 10);
    expect(loaded!.total.gCO2eHigh).toBeCloseTo(total.gCO2eHigh, 10);
    expect(loaded!.total.confidence).toBe('modelled');
  });

  it('restoring a conversation and adding a response does not double-count the stored total', async () => {
    const area = fakeStorageArea();
    const repository = new ChromeStorageConversationRepository(area);

    const stored = Estimate.fromEnergyBreakdown({
      usage: new TokenUsage(10, 100, 0),
      energyWh: 0.1,
      electricityG: 0.03,
      embodiedG: 0.005,
      uncertaintyFactor: 3,
      confidence: 'modelled',
    });
    await repository.save(new Conversation('conv-2', 'claude', stored, 1));

    const restored = await repository.load('conv-2');
    expect(restored!.total.gCO2e).toBeCloseTo(stored.gCO2e, 10);

    const extra = Estimate.fromEnergyBreakdown({
      usage: new TokenUsage(1, 1, 0),
      energyWh: 0.01,
      electricityG: 0.003,
      embodiedG: 0.0005,
      uncertaintyFactor: 3,
      confidence: 'modelled',
    });
    restored!.addEstimate(extra);

    expect(restored!.total.gCO2e).toBeCloseTo(stored.gCO2e + extra.gCO2e, 10);
    expect(restored!.responseCount).toBe(2);
  });

  it('never writes anything but numbers, strings and the id/providerId under the conversation key', async () => {
    const area = fakeStorageArea();
    const repository = new ChromeStorageConversationRepository(area);
    await repository.save(new Conversation('conv-3', 'claude'));

    const setMock = vi.mocked(area.set);
    const [written] = setMock.mock.calls[0] ?? [];
    const [key, record] = Object.entries(written as Record<string, unknown>)[0] as [string, Record<string, unknown>];

    expect(key).toBe('carbometre:conversation:conv-3');
    for (const value of Object.values(record)) {
      expect(['number', 'string']).toContain(typeof value);
    }
  });

  it('all() lists every stored conversation and ignores unrelated keys', async () => {
    const area = fakeStorageArea();
    await area.set({ 'carbometre:settings': { language: 'fr' } });
    const repository = new ChromeStorageConversationRepository(area);
    await repository.save(new Conversation('a', 'claude'));
    await repository.save(new Conversation('b', 'gpt'));

    const ids = (await repository.all()).map((c) => c.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('clear() removes only conversations, leaving other keys alone', async () => {
    const area = fakeStorageArea();
    await area.set({ 'carbometre:settings': { language: 'fr' } });
    const repository = new ChromeStorageConversationRepository(area);
    await repository.save(new Conversation('a', 'claude'));

    await repository.clear();
    expect(await repository.all()).toEqual([]);
    expect(((await area.get(null)) as Record<string, unknown>)['carbometre:settings']).toEqual({ language: 'fr' });
    await repository.clear(); // nothing to remove: must not throw
  });
});
