import type { Conversation } from '@carbometre/core';
import type { Settings } from '../storage/SettingsRepository.js';
import type { UsageHistorySnapshot } from '../storage/UsageHistoryRepository.js';

/**
 * Builds the files the Options page lets the user download. Pure
 * functions: they turn already-loaded data into text and never touch
 * storage, so they are trivially testable and the numbers are exactly
 * what the dashboard would show.
 *
 * Numbers use "." as the decimal separator and CSV uses "," as the field
 * separator (RFC 4180): machine-readable first. Nothing here is message
 * content - ids, counts and totals only.
 */

export interface ExportBundle {
  readonly exportedAt: string;
  readonly version: string;
  readonly settings: Settings;
  readonly history: {
    readonly cumulative: { readonly gCO2e: number; readonly since: string };
    readonly allTime: { readonly gCO2e: number; readonly since: string };
    readonly daily: Readonly<Record<string, number>>;
  };
  readonly conversations: readonly ConversationRow[];
}

export interface ConversationRow {
  readonly id: string;
  readonly providerId: string;
  readonly responseCount: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly thinkingTokens: number;
  readonly energyWh: number;
  readonly gCO2e: number;
  readonly gCO2eLow: number;
  readonly gCO2eHigh: number;
  readonly confidence: string;
}

export function conversationRow(conversation: Conversation): ConversationRow {
  const { total } = conversation;
  return {
    id: conversation.id,
    providerId: conversation.providerId,
    responseCount: conversation.responseCount,
    tokensIn: total.usage.tokensIn,
    tokensOut: total.usage.tokensOut,
    thinkingTokens: total.usage.thinkingTokens,
    energyWh: total.energyWh,
    gCO2e: total.gCO2e,
    gCO2eLow: total.gCO2eLow,
    gCO2eHigh: total.gCO2eHigh,
    confidence: total.confidence,
  };
}

export function buildExportBundle(
  conversations: readonly Conversation[],
  history: UsageHistorySnapshot,
  settings: Settings,
  version: string,
  now: Date = new Date(),
): ExportBundle {
  return {
    exportedAt: now.toISOString(),
    version,
    settings,
    history: {
      cumulative: { gCO2e: history.cumulative.gCO2e, since: history.cumulative.since.toISOString() },
      allTime: { gCO2e: history.allTime.gCO2e, since: history.allTime.since.toISOString() },
      daily: history.daily,
    },
    conversations: conversations.map(conversationRow),
  };
}

export function toJson(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

const CONVERSATION_COLUMNS: readonly (keyof ConversationRow)[] = [
  'id',
  'providerId',
  'responseCount',
  'tokensIn',
  'tokensOut',
  'thinkingTokens',
  'energyWh',
  'gCO2e',
  'gCO2eLow',
  'gCO2eHigh',
  'confidence',
];

export function conversationsCsv(rows: readonly ConversationRow[]): string {
  const lines = [CONVERSATION_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(CONVERSATION_COLUMNS.map((column) => csvCell(row[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function dailyCsv(daily: Readonly<Record<string, number>>): string {
  const lines = ['day,gCO2e'];
  for (const day of Object.keys(daily).sort()) {
    lines.push(`${csvCell(day)},${csvCell(daily[day] ?? 0)}`);
  }
  return `${lines.join('\n')}\n`;
}

function csvCell(value: string | number): string {
  if (typeof value === 'number') {
    return String(value);
  }
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
