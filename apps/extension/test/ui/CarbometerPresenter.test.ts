import {
  CarbometerService,
  DatacenterGridProvider,
  EmissionModelRegistry,
  EquivalenceCatalog,
  HeuristicTokenizer,
  ModelRegistry,
  type ModelProfileProps,
  TokenBasedEmissionModel,
} from '@carbometre/core';
import type { CalculationSettingsSink } from '../../src/calculation/CalculationSettingsSink.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type RawResponse, SiteAdapter } from '../../src/adapters/SiteAdapter.js';
import type { Messages } from '../../src/i18n/Messages.js';
import type { ConversationRepository } from '../../src/storage/ConversationRepository.js';
import { DEFAULT_SETTINGS } from '../../src/storage/ChromeStorageSettingsRepository.js';
import type { Settings, SettingsRepository } from '../../src/storage/SettingsRepository.js';
import type {
  CumulativeUsage,
  UsageHistoryRepository,
  UsageHistorySnapshot,
} from '../../src/storage/UsageHistoryRepository.js';
import type { Unsubscribe } from '../../src/types.js';
import { CarbometerPresenter } from '../../src/ui/CarbometerPresenter.js';
import type { Confirmation, ConfirmationRequest } from '../../src/ui/Confirmation.js';
import type { Conversation, FallbackHint } from '@carbometre/core';

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

  fallbackModel(): FallbackHint {
    return { providerId: 'claude', tier: 'frontier' };
  }

  currentConversationId(): string | null {
    return this.conversationId;
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

  async all(): Promise<readonly Conversation[]> {
    return Array.from(this.store.values());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

class StubMessages implements Messages {
  get(key: string): string {
    return key;
  }
}

class InMemoryUsageHistoryRepository implements UsageHistoryRepository {
  private total = 0;
  private lifetime = 0;
  private since = new Date('2026-09-01T00:00:00Z');

  async record(gCO2e: number): Promise<void> {
    this.total += gCO2e;
    this.lifetime += gCO2e;
  }

  async totalForLastDays(): Promise<number> {
    return this.lifetime;
  }

  async totalSince(): Promise<number> {
    return this.lifetime;
  }

  async cumulative(): Promise<CumulativeUsage> {
    return { gCO2e: this.total, since: this.since };
  }

  async allTime(): Promise<CumulativeUsage> {
    return { gCO2e: this.lifetime, since: new Date('2026-08-01T00:00:00Z') };
  }

  async snapshot(): Promise<UsageHistorySnapshot> {
    return { daily: {}, cumulative: await this.cumulative(), allTime: await this.allTime() };
  }

  async clear(): Promise<void> {
    this.total = 0;
    this.lifetime = 0;
  }

  async reset(now: Date = new Date('2026-09-15T00:00:00Z')): Promise<void> {
    this.total = 0;
    this.since = now;
  }
}

class InMemorySettingsRepository implements SettingsRepository {
  private readonly listeners = new Set<(settings: Settings) => void>();

  constructor(public settings: Settings = DEFAULT_SETTINGS) {}

  async load(): Promise<Settings> {
    return this.settings;
  }

  async save(settings: Settings): Promise<void> {
    this.settings = settings;
  }

  onChange(listener: (settings: Settings) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Simulates another page (the Options page) writing the same key. */
  emitExternalChange(settings: Settings): void {
    this.settings = settings;
    for (const listener of this.listeners) {
      listener(settings);
    }
  }
}

class ScriptedConfirmation implements Confirmation {
  readonly requests: ConfirmationRequest[] = [];
  constructor(private readonly answer: boolean) {}

  async ask(request: ConfirmationRequest): Promise<boolean> {
    this.requests.push(request);
    return this.answer;
  }
}

class RecordingCalculationSink implements CalculationSettingsSink {
  readonly received: Settings[] = [];

  apply(settings: Settings): void {
    this.received.push(settings);
  }
}

function buildService(): CarbometerService {
  return new CarbometerService(
    new HeuristicTokenizer(),
    ModelRegistry.fromCatalog(CATALOG),
    new EmissionModelRegistry().register('token-based', new TokenBasedEmissionModel(new DatacenterGridProvider())),
  );
}

interface Harness {
  readonly presenter: CarbometerPresenter;
  readonly usageHistory: InMemoryUsageHistoryRepository;
  readonly settings: InMemorySettingsRepository;
  readonly calculation: RecordingCalculationSink;
  readonly confirmation: ScriptedConfirmation;
  readonly openOptions: ReturnType<typeof vi.fn>;
}

function buildHarness(
  adapter: StubAdapter,
  repository: InMemoryConversationRepository,
  settings: InMemorySettingsRepository = new InMemorySettingsRepository(),
  confirmation: ScriptedConfirmation = new ScriptedConfirmation(true),
): Harness {
  const usageHistory = new InMemoryUsageHistoryRepository();
  const calculation = new RecordingCalculationSink();
  const openOptions = vi.fn();
  const presenter = new CarbometerPresenter({
    adapter,
    service: buildService(),
    conversations: repository,
    usageHistory,
    settings,
    calculation,
    equivalences: new EquivalenceCatalog(),
    confirmation,
    messages: new StubMessages(),
    methodologyUrl: METHODOLOGY_URL,
    openOptions,
    doc: document,
  });
  return { presenter, usageHistory, settings, calculation, confirmation, openOptions };
}

function buildPresenter(adapter: StubAdapter, repository: InMemoryConversationRepository): CarbometerPresenter {
  return buildHarness(adapter, repository).presenter;
}

function openDashboard(): HTMLElement {
  (document.querySelector('.carbometre-badge') as HTMLButtonElement).click();
  return document.querySelector('.carbometre-dashboard') as HTMLElement;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'en-US' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CarbometerPresenter', () => {
  it('mounts the floating badge to the body and shows the restored total for the current conversation', async () => {
    const repository = new InMemoryConversationRepository();
    const adapter = new StubAdapter(document);
    const presenter = buildPresenter(adapter, repository);

    presenter.start();
    await flushMicrotasks();

    const badge = document.querySelector('.carbometre-badge');
    expect(badge).not.toBeNull();
    expect(badge?.parentElement).toBe(document.body);
    expect(badge?.textContent).toBe('0.00 gCO2e');
  });

  it('accumulates each new response into the running total shown on the badge', async () => {
    const repository = new InMemoryConversationRepository();
    const adapter = new StubAdapter(document);
    const presenter = buildPresenter(adapter, repository);

    presenter.start();
    await flushMicrotasks();

    adapter.emit({ promptText: 'y'.repeat(200), responseText: 'x'.repeat(2000) });
    await flushMicrotasks();

    const badge = document.querySelector('.carbometre-badge');
    expect(badge?.textContent).not.toBe('0.00 gCO2e');

    const firstReading = badge?.textContent;
    adapter.emit({ promptText: 'y'.repeat(200), responseText: 'x'.repeat(2000) });
    await flushMicrotasks();

    expect(badge?.textContent).not.toBe(firstReading);
    expect(await repository.load('conv-1').then((c) => c?.responseCount)).toBe(2);
  });

  it('restores a previously-visited conversation total instead of starting at zero, without double-counting', async () => {
    const repository = new InMemoryConversationRepository();
    const seedAdapter = new StubAdapter(document);
    const presenter1 = buildPresenter(seedAdapter, repository);
    presenter1.start();
    await flushMicrotasks();
    seedAdapter.emit({ promptText: 'y'.repeat(200), responseText: 'x'.repeat(2000) });
    await flushMicrotasks();
    const storedTotal = await repository.load('conv-1').then((c) => c?.total.gCO2e);
    presenter1.stop();

    // Simulate navigating away and back: a fresh presenter/adapter pair for
    // the same conversation id should show the stored total, not zero.
    document.body.innerHTML = '';
    const returningAdapter = new StubAdapter(document);
    const presenter2 = buildPresenter(returningAdapter, repository);
    presenter2.start();
    await flushMicrotasks();

    const reloadedTotal = await repository.load('conv-1').then((c) => c?.total.gCO2e);
    expect(reloadedTotal).toBeCloseTo(storedTotal!, 10);
  });

  it('shows the "unavailable" state when there is no open conversation', async () => {
    const repository = new InMemoryConversationRepository();
    const adapter = new StubAdapter(document);
    adapter.conversationId = null;
    const presenter = buildPresenter(adapter, repository);

    presenter.start();
    await flushMicrotasks();

    expect(document.querySelector('.carbometre-badge')?.textContent).toBe('--');
  });

  it('still counts a response when the model picker cannot be read, marking the estimate as guessed', async () => {
    // Dropping these silently is what left the badge frozen on chatgpt.com
    // when a guessed model-picker selector didn't match. Counting against the
    // adapter's fallback tier - and saying so via confidence: 'guessed' - is
    // the honest version of "we're less sure", rather than "nothing happened".
    // Asserted on responseCount, not badge text: a short exchange rounds to
    // 0.00 either way, so a text assertion would pass for free.
    const repository = new InMemoryConversationRepository();
    const adapter = new StubAdapter(document);
    const presenter = buildPresenter(adapter, repository);
    presenter.start();
    await flushMicrotasks();

    adapter.modelId = null;
    adapter.emit({ promptText: 'y'.repeat(200), responseText: 'x'.repeat(2000) });
    await flushMicrotasks();

    const stored = await repository.load('conv-1');
    expect(stored?.responseCount).toBe(1);
    expect(stored?.total.gCO2e).toBeGreaterThan(0);
    expect(stored?.total.confidence).toBe('guessed');
  });

  it('pushes the stored settings to the calculation on start', async () => {
    const french = buildHarness(
      new StubAdapter(document),
      new InMemoryConversationRepository(),
      new InMemorySettingsRepository({ ...DEFAULT_SETTINGS, userLocation: 'fr', gridReference: 'french-mix' }),
    );
    french.presenter.start();
    await flushMicrotasks();
    expect(french.calculation.received).toHaveLength(1);
    expect(french.calculation.received[0]?.userLocation).toBe('fr');
    expect(french.calculation.received[0]?.gridReference).toBe('french-mix');
  });

  it('applies settings changed from elsewhere (the Options page) without a reload, and stops on stop()', async () => {
    const harness = buildHarness(new StubAdapter(document), new InMemoryConversationRepository());
    harness.presenter.start();
    await flushMicrotasks();
    const before = harness.calculation.received.length;

    harness.settings.emitExternalChange({ ...DEFAULT_SETTINGS, coefficientOverrides: { 'claude-frontier': { pue: 1.2 } } });
    expect(harness.calculation.received).toHaveLength(before + 1);
    expect(harness.calculation.received.at(-1)?.coefficientOverrides['claude-frontier']?.pue).toBe(1.2);

    harness.presenter.stop();
    harness.settings.emitExternalChange(DEFAULT_SETTINGS);
    expect(harness.calculation.received).toHaveLength(before + 1);
  });

  it('the dashboard "Options" button asks the host to open the Options page', async () => {
    const harness = buildHarness(new StubAdapter(document), new InMemoryConversationRepository());
    harness.presenter.start();
    await flushMicrotasks();
    const panel = openDashboard();
    (panel.querySelector('.carbometre-dashboard-options-button') as HTMLButtonElement).click();
    expect(harness.openOptions).toHaveBeenCalledTimes(1);
  });

  it('changing the location from the dashboard asks for confirmation, then persists it and re-informs the grid provider', async () => {
    const harness = buildHarness(new StubAdapter(document), new InMemoryConversationRepository());
    harness.presenter.start();
    await flushMicrotasks();
    const panel = openDashboard();
    await flushMicrotasks();

    const locationSelect = panel.querySelectorAll<HTMLSelectElement>('.carbometre-dashboard-select')[1]!;
    locationSelect.value = 'fr';
    locationSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushMicrotasks();

    expect(harness.confirmation.requests).toHaveLength(1);
    expect(harness.confirmation.requests[0]?.message).toBe('locationChangeWarning');
    expect(harness.settings.settings.userLocation).toBe('fr');
    expect(harness.calculation.received.at(-1)?.userLocation).toBe('fr');
  });

  it('a declined location change applies nothing and puts the select back', async () => {
    const harness = buildHarness(
      new StubAdapter(document),
      new InMemoryConversationRepository(),
      new InMemorySettingsRepository({ ...DEFAULT_SETTINGS, userLocation: 'other' }),
      new ScriptedConfirmation(false),
    );
    harness.presenter.start();
    await flushMicrotasks();
    const panel = openDashboard();
    await flushMicrotasks();

    const locationSelect = panel.querySelectorAll<HTMLSelectElement>('.carbometre-dashboard-select')[1]!;
    locationSelect.value = 'fr';
    locationSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushMicrotasks();

    expect(harness.confirmation.requests).toHaveLength(1);
    expect(harness.settings.settings.userLocation).toBe('other');
    expect(harness.calculation.received.every((s) => s.userLocation === 'other')).toBe(true);
    expect(locationSelect.value).toBe('other');
  });

  it('the open dashboard follows the badge while it is dragged', async () => {
    const harness = buildHarness(new StubAdapter(document), new InMemoryConversationRepository());
    harness.presenter.start();
    await flushMicrotasks();
    const badge = document.querySelector('.carbometre-badge') as HTMLButtonElement;
    Object.defineProperty(badge, 'offsetWidth', { value: 80, configurable: true });
    Object.defineProperty(badge, 'offsetHeight', { value: 20, configurable: true });
    let badgeRect = { top: 100, bottom: 120, left: 50, right: 130, width: 80, height: 20 };
    badge.getBoundingClientRect = () => ({ ...badgeRect, x: badgeRect.left, y: badgeRect.top, toJSON() {} }) as DOMRect;

    const panel = openDashboard();
    await flushMicrotasks();
    panel.getBoundingClientRect = () =>
      ({ top: 0, bottom: 100, left: 0, right: 200, width: 200, height: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;
    expect(panel.style.left).toBe('50px');

    // Drag: pointerdown, then a move well past the click threshold. The
    // badge repositions itself from the pointer delta; the stubbed rect
    // stands in for the layout the real browser would report afterwards.
    badge.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 60, clientY: 110, bubbles: true }));
    badgeRect = { top: 300, bottom: 320, left: 250, right: 330, width: 80, height: 20 };
    badge.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 260, clientY: 310, bubbles: true }));

    expect(panel.style.left).toBe('250px');
    expect(panel.style.top).toBe('328px');
    badge.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 260, clientY: 310, bubbles: true }));
  });

  it('changing the equivalence persists it and re-renders the equivalent line in the new unit', async () => {
    const harness = buildHarness(new StubAdapter(document), new InMemoryConversationRepository());
    await harness.usageHistory.record(1000);
    harness.presenter.start();
    await flushMicrotasks();
    const panel = openDashboard();
    await flushMicrotasks();

    const equivalentValue = (): string | null | undefined =>
      panel.querySelectorAll('.carbometre-dashboard-value')[2]?.textContent;
    expect(equivalentValue()).toBe('equivalentValueCarKm'); // StubMessages ignores substitutions

    const equivalenceSelect = panel.querySelectorAll<HTMLSelectElement>('.carbometre-dashboard-select')[0]!;
    equivalenceSelect.value = 'plane-km';
    equivalenceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushMicrotasks();

    expect(harness.settings.settings.equivalenceId).toBe('plane-km');
    expect(equivalentValue()).toBe('equivalentValuePlaneKm');
  });

  it('reset clears the cumulative total shown in the dashboard but leaves the conversation total alone', async () => {
    const repository = new InMemoryConversationRepository();
    const adapter = new StubAdapter(document);
    const harness = buildHarness(adapter, repository);
    harness.presenter.start();
    await flushMicrotasks();
    adapter.emit({ promptText: 'y'.repeat(200), responseText: 'x'.repeat(20000) });
    await flushMicrotasks();

    const panel = openDashboard();
    await flushMicrotasks();
    const values = (): string[] =>
      Array.from(panel.querySelectorAll('.carbometre-dashboard-value')).map((el) => el.textContent ?? '');
    const [conversationBefore, cumulativeBefore] = values();
    expect(cumulativeBefore).not.toBe('0.00 gCO2e');
    expect(cumulativeBefore).toBe(conversationBefore);

    const reset = panel.querySelector('.carbometre-dashboard-reset') as HTMLButtonElement;
    reset.click();
    reset.click();
    await flushMicrotasks();

    const [conversationAfter, cumulativeAfter] = values();
    expect(cumulativeAfter).toBe('0.00 gCO2e');
    expect(conversationAfter).toBe(conversationBefore);
    expect((await harness.usageHistory.cumulative()).gCO2e).toBe(0);

    // The all-time figure under "details" survives the reset - that is its whole point.
    (panel.querySelector('.carbometre-dashboard-details-toggle') as HTMLButtonElement).click();
    const sinceInstall = panel.querySelector('.carbometre-dashboard-detail')?.textContent ?? '';
    expect(sinceInstall).toContain(conversationBefore);
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
