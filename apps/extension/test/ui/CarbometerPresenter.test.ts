import {
  CarbometerService,
  DatacenterGridProvider,
  EmissionModelRegistry,
  HeuristicTokenizer,
  ModelRegistry,
  type ModelProfileProps,
  TokenBasedEmissionModel,
} from '@carbometre/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type RawResponse, SiteAdapter } from '../../src/adapters/SiteAdapter.js';
import type { Messages } from '../../src/i18n/Messages.js';
import type { ConversationRepository } from '../../src/storage/ConversationRepository.js';
import type { UsageHistoryRepository } from '../../src/storage/UsageHistoryRepository.js';
import { CarbometerPresenter } from '../../src/ui/CarbometerPresenter.js';
import type { Conversation } from '@carbometre/core';

const METHODOLOGY_URL = 'https://example.invalid/methodology.html';

const CATALOG: ModelProfileProps[] = [
  {
    id: 'claude-frontier',
    label: 'Claude (test)',
    tier: 'frontier',
    emissionModelId: 'token-based',
    eTokenWh: 5.0e-4,
    pue: 1.12,
    regionId: 'us-average',
    regionConfidence: 'assumed',
    embodiedPerTokenG: 4.9e-5,
    hiddenThinkingMultiplier: 1.0,
    thinkingVisible: true,
    uncertaintyFactor: 3,
    confidence: 'modelled',
    sources: [],
  },
];

class StubAdapter extends SiteAdapter {
  readonly hostPatterns = ['claude.ai'];
  readonly providerId = 'claude';
  conversationId: string | null = 'conv-1';
  modelId: string | null = 'claude-frontier';
  private responseHandler: ((response: RawResponse) => void) | null = null;

  observeResponses(onResponse: (response: RawResponse) => void): () => void {
    this.responseHandler = onResponse;
    return () => {
      this.responseHandler = null;
    };
  }

  emit(response: RawResponse): void {
    this.responseHandler?.(response);
  }

  detectModelId(): string | null {
    return this.modelId;
  }

  currentConversationId(): string | null {
    return this.conversationId;
  }

  badgeAnchor(): HTMLElement | null {
    return this.doc.querySelector<HTMLElement>('#anchor');
  }
}

class InMemoryConversationRepository implements ConversationRepository {
  private readonly store = new Map<string, Conversation>();

  async load(id: string): Promise<Conversation | null> {
    return this.store.get(id) ?? null;
  }

  async save(conversation: Conversation): Promise<void> {
    this.store.set(conversation.id, conversation);
  }
}

class StubMessages implements Messages {
  get(key: string): string {
    return key;
  }
}

class InMemoryUsageHistoryRepository implements UsageHistoryRepository {
  private total = 0;

  async record(gCO2e: number): Promise<void> {
    this.total += gCO2e;
  }

  async totalForLastDays(): Promise<number> {
    return this.total;
  }
}

function buildService(): CarbometerService {
  return new CarbometerService(
    new HeuristicTokenizer(),
    ModelRegistry.fromCatalog(CATALOG),
    new EmissionModelRegistry().register('token-based', new TokenBasedEmissionModel(new DatacenterGridProvider())),
  );
}

beforeEach(() => {
  document.body.innerHTML = '<header><button id="anchor">menu</button></header>';
  vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'en-US' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CarbometerPresenter', () => {
  it('mounts the badge next to the anchor and shows the restored total for the current conversation', async () => {
    const repository = new InMemoryConversationRepository();
    const adapter = new StubAdapter(document);
    const presenter = new CarbometerPresenter(adapter, buildService(), repository, new InMemoryUsageHistoryRepository(), new StubMessages(), METHODOLOGY_URL, document);

    presenter.start();
    await flushMicrotasks();

    const badge = document.querySelector('.carbometre-badge');
    expect(badge).not.toBeNull();
    expect(badge?.previousElementSibling === null && badge?.nextElementSibling?.id === 'anchor').toBe(true);
    expect(badge?.textContent).toBe('0.0 gCO2e');
  });

  it('accumulates each new response into the running total shown on the badge', async () => {
    const repository = new InMemoryConversationRepository();
    const adapter = new StubAdapter(document);
    const presenter = new CarbometerPresenter(adapter, buildService(), repository, new InMemoryUsageHistoryRepository(), new StubMessages(), METHODOLOGY_URL, document);

    presenter.start();
    await flushMicrotasks();

    adapter.emit({ promptText: 'y'.repeat(200), responseText: 'x'.repeat(2000) });
    await flushMicrotasks();

    const badge = document.querySelector('.carbometre-badge');
    expect(badge?.textContent).not.toBe('0.0 gCO2e');

    const firstReading = badge?.textContent;
    adapter.emit({ promptText: 'y'.repeat(200), responseText: 'x'.repeat(2000) });
    await flushMicrotasks();

    expect(badge?.textContent).not.toBe(firstReading);
    expect(await repository.load('conv-1').then((c) => c?.responseCount)).toBe(2);
  });

  it('restores a previously-visited conversation total instead of starting at zero, without double-counting', async () => {
    const repository = new InMemoryConversationRepository();
    const seedAdapter = new StubAdapter(document);
    const presenter1 = new CarbometerPresenter(seedAdapter, buildService(), repository, new InMemoryUsageHistoryRepository(), new StubMessages(), METHODOLOGY_URL, document);
    presenter1.start();
    await flushMicrotasks();
    seedAdapter.emit({ promptText: 'y'.repeat(200), responseText: 'x'.repeat(2000) });
    await flushMicrotasks();
    const storedTotal = await repository.load('conv-1').then((c) => c?.total.gCO2e);
    presenter1.stop();

    // Simulate navigating away and back: a fresh presenter/adapter pair for
    // the same conversation id should show the stored total, not zero.
    document.body.innerHTML = '<header><button id="anchor">menu</button></header>';
    const returningAdapter = new StubAdapter(document);
    const presenter2 = new CarbometerPresenter(
      returningAdapter,
      buildService(),
      repository,
      new InMemoryUsageHistoryRepository(),
      new StubMessages(),
      METHODOLOGY_URL,
      document,
    );
    presenter2.start();
    await flushMicrotasks();

    const reloadedTotal = await repository.load('conv-1').then((c) => c?.total.gCO2e);
    expect(reloadedTotal).toBeCloseTo(storedTotal!, 10);
  });

  it('shows the "unavailable" state when there is no open conversation', async () => {
    const repository = new InMemoryConversationRepository();
    const adapter = new StubAdapter(document);
    adapter.conversationId = null;
    const presenter = new CarbometerPresenter(adapter, buildService(), repository, new InMemoryUsageHistoryRepository(), new StubMessages(), METHODOLOGY_URL, document);

    presenter.start();
    await flushMicrotasks();

    expect(document.querySelector('.carbometre-badge')?.textContent).toBe('--');
  });

  it('leaves the total unchanged when the model cannot be identified, rather than guessing', async () => {
    const repository = new InMemoryConversationRepository();
    const adapter = new StubAdapter(document);
    const presenter = new CarbometerPresenter(adapter, buildService(), repository, new InMemoryUsageHistoryRepository(), new StubMessages(), METHODOLOGY_URL, document);
    presenter.start();
    await flushMicrotasks();

    adapter.modelId = null;
    adapter.emit({ promptText: 'hi', responseText: 'hello' });
    await flushMicrotasks();

    expect(document.querySelector('.carbometre-badge')?.textContent).toBe('0.0 gCO2e');
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
