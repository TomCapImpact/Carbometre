import { Conversation, Estimate, TokenUsage } from '@carbometre/core';
import { describe, expect, it } from 'vitest';
import { buildExportBundle, conversationsCsv, dailyCsv, toJson } from '../../src/export/UsageExport.js';
import { DEFAULT_SETTINGS } from '../../src/storage/ChromeStorageSettingsRepository.js';

function conversation(id: string, gCO2e: number): Conversation {
  const total = Estimate.fromEnergyBreakdown({
    usage: new TokenUsage(50, 500, 0),
    energyWh: 0.28,
    electricityG: gCO2e * 0.8,
    embodiedG: gCO2e * 0.2,
    uncertaintyFactor: 3,
    confidence: 'modelled',
  });
  return new Conversation(id, 'claude', total, 2);
}

const HISTORY = {
  daily: { '2026-09-15': 1.5, '2026-09-01': 0.25 },
  cumulative: { gCO2e: 1.75, since: new Date('2026-09-01T00:00:00Z') },
  allTime: { gCO2e: 1.75, since: new Date('2026-09-01T00:00:00Z') },
};

describe('buildExportBundle / toJson', () => {
  it('serialises ids, counts and totals - and nothing that could be message text', () => {
    const bundle = buildExportBundle(
      [conversation('c1', 1.0)],
      HISTORY,
      DEFAULT_SETTINGS,
      '1.0.0',
      new Date('2026-09-15T12:00:00Z'),
    );
    expect(bundle.exportedAt).toBe('2026-09-15T12:00:00.000Z');
    expect(bundle.version).toBe('1.0.0');
    expect(bundle.history.cumulative).toEqual({ gCO2e: 1.75, since: '2026-09-01T00:00:00.000Z' });
    expect(bundle.conversations[0]).toMatchObject({ id: 'c1', providerId: 'claude', responseCount: 2, tokensOut: 500 });
    expect(bundle.conversations[0]?.gCO2e).toBeCloseTo(1.0, 10);
    expect(JSON.parse(toJson(bundle))).toEqual(bundle);
    expect(Object.keys(bundle.conversations[0]!)).not.toContain('text');
  });
});

describe('conversationsCsv', () => {
  it('writes a header and one RFC 4180 row per conversation, quoting only when needed', () => {
    const bundle = buildExportBundle(
      [conversation('a,b', 2.5), conversation('plain', 0.5)],
      HISTORY,
      DEFAULT_SETTINGS,
      '1.0.0',
    );
    const lines = conversationsCsv(bundle.conversations).trimEnd().split('\n');
    expect(lines[0]).toBe(
      'id,providerId,responseCount,tokensIn,tokensOut,thinkingTokens,energyWh,gCO2e,gCO2eLow,gCO2eHigh,confidence',
    );
    expect(lines[1]?.startsWith('"a,b",claude,2,50,500,0,0.28,2.5,')).toBe(true);
    expect(lines[2]?.startsWith('plain,claude,2,50,500,0,0.28,0.5,')).toBe(true);
    expect(lines).toHaveLength(3);
  });
});

describe('dailyCsv', () => {
  it('lists days in chronological order', () => {
    expect(dailyCsv(HISTORY.daily)).toBe('day,gCO2e\n2026-09-01,0.25\n2026-09-15,1.5\n');
  });

  it('is just the header when empty', () => {
    expect(dailyCsv({})).toBe('day,gCO2e\n');
  });
});
