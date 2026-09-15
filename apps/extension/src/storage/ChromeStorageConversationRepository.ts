import { type Confidence, Conversation, Estimate, TokenUsage } from '@carbometre/core';
import type { ConversationRepository } from './ConversationRepository.js';

const STORAGE_KEY_PREFIX = 'carbometre:conversation:';

/** The only shape ever written to chrome.storage.local: numbers and strings, never message text. */
interface StoredConversationRecord {
  readonly id: string;
  readonly providerId: string;
  readonly responseCount: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly thinkingTokens: number;
  readonly energyWh: number;
  readonly electricityG: number;
  readonly embodiedG: number;
  readonly gCO2eLow: number;
  readonly gCO2eHigh: number;
  readonly confidence: Confidence;
}

export class ChromeStorageConversationRepository implements ConversationRepository {
  constructor(private readonly storageArea: chrome.storage.StorageArea = chrome.storage.local) {}

  async load(id: string): Promise<Conversation | null> {
    const key = this.keyFor(id);
    const result = (await this.storageArea.get(key)) as Record<string, StoredConversationRecord | undefined>;
    const record = result[key];
    return record ? this.toConversation(record) : null;
  }

  async save(conversation: Conversation): Promise<void> {
    await this.storageArea.set({ [this.keyFor(conversation.id)]: this.toRecord(conversation) });
  }

  async all(): Promise<readonly Conversation[]> {
    const everything = (await this.storageArea.get(null)) as Record<string, unknown>;
    return Object.entries(everything)
      .filter(([key]) => key.startsWith(STORAGE_KEY_PREFIX))
      .map(([, record]) => this.toConversation(record as StoredConversationRecord));
  }

  async clear(): Promise<void> {
    const everything = (await this.storageArea.get(null)) as Record<string, unknown>;
    const keys = Object.keys(everything).filter((key) => key.startsWith(STORAGE_KEY_PREFIX));
    if (keys.length > 0) {
      await this.storageArea.remove(keys);
    }
  }

  private keyFor(id: string): string {
    return `${STORAGE_KEY_PREFIX}${id}`;
  }

  private toRecord(conversation: Conversation): StoredConversationRecord {
    const { total } = conversation;
    return {
      id: conversation.id,
      providerId: conversation.providerId,
      responseCount: conversation.responseCount,
      tokensIn: total.usage.tokensIn,
      tokensOut: total.usage.tokensOut,
      thinkingTokens: total.usage.thinkingTokens,
      energyWh: total.energyWh,
      electricityG: total.electricityG,
      embodiedG: total.embodiedG,
      gCO2eLow: total.gCO2eLow,
      gCO2eHigh: total.gCO2eHigh,
      confidence: total.confidence,
    };
  }

  private toConversation(record: StoredConversationRecord): Conversation {
    const total = new Estimate({
      usage: new TokenUsage(record.tokensIn, record.tokensOut, record.thinkingTokens),
      energyWh: record.energyWh,
      electricityG: record.electricityG,
      embodiedG: record.embodiedG,
      gCO2eLow: record.gCO2eLow,
      gCO2eHigh: record.gCO2eHigh,
      confidence: record.confidence,
    });
    return new Conversation(record.id, record.providerId, total, record.responseCount);
  }
}
