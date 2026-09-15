import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Conversation, Estimate, ModelRegistry, type ModelProfileProps, TokenUsage } from '@carbometre/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Messages } from '../../src/i18n/Messages.js';
import { DEFAULT_SETTINGS } from '../../src/storage/ChromeStorageSettingsRepository.js';
import type { ConversationRepository } from '../../src/storage/ConversationRepository.js';
import type { Settings, SettingsRepository } from '../../src/storage/SettingsRepository.js';
import type {
  CumulativeUsage,
  UsageHistoryRepository,
  UsageHistorySnapshot,
} from '../../src/storage/UsageHistoryRepository.js';
import type { Confirmation, ConfirmationRequest } from '../../src/ui/Confirmation.js';
import type { FileSaver } from '../../src/ui/FileSaver.js';
import { OptionsPage } from '../../src/ui/OptionsPage.js';

/** The real markup: a missing id or attribute must fail here, not in the browser. */
const OPTIONS_HTML = readFileSync(resolve(process.cwd(), 'options.html'), 'utf8');

const CATALOG: ModelProfileProps[] = [
  {
    id: 'claude-frontier',
    label: 'Claude frontier',
    tier: 'frontier',
    emissionModelId: 'token-based',
    eTokenWh: 5.0e-4,
    pue: 1.54,
    regionId: 'us-average',
    regionConfidence: 'assumed',
    embodiedPerTokenG: 4.9e-5,
    hiddenThinkingMultiplier: 1.0,
    thinkingVisible: true,
    uncertaintyFactor: 3.0,
    confidence: 'modelled',
    sources: [],
  },
  {
    id: 'gpt-mid',
    label: 'GPT mid',
    tier: 'mid',
    emissionModelId: 'token-based',
    eTokenWh: 2.0e-4,
    pue: 1.54,
    regionId: 'us-average',
    regionConfidence: 'assumed',
    embodiedPerTokenG: 2.0e-5,
    hiddenThinkingMultiplier: 4.0,
    thinkingVisible: false,
    uncertaintyFactor: 3.0,
    confidence: 'modelled',
    sources: [],
  },
];

class StubMessages implements Messages {
  get(key: string, substitutions?: string[]): string {
    return substitutions ? `${key}(${substitutions.join('|')})` : key;
  }
}

class InMemorySettingsRepository implements SettingsRepository {
  saves = 0;
  constructor(public settings: Settings = DEFAULT_SETTINGS) {}
  async load(): Promise<Settings> {
    return this.settings;
  }
  async save(settings: Settings): Promise<void> {
    this.settings = settings;
    this.saves += 1;
  }
  onChange(): () => void {
    return () => undefined;
  }
}

class InMemoryConversationRepository implements ConversationRepository {
  store = new Map<string, Conversation>();
  async load(id: string): Promise<Conversation | null> {
    return this.store.get(id) ?? null;
  }
  async save(c: Conversation): Promise<void> {
    this.store.set(c.id, c);
  }
  async all(): Promise<readonly Conversation[]> {
    return Array.from(this.store.values());
  }
  async clear(): Promise<void> {
    this.store.clear();
  }
}

class InMemoryUsageHistoryRepository implements UsageHistoryRepository {
  daily: Record<string, number> = { '2026-09-15': 1.5 };
  cleared = false;
  async record(): Promise<void> {}
  async totalForLastDays(): Promise<number> {
    return 1.5;
  }
  async totalSince(): Promise<number> {
    return 1.5;
  }
  async cumulative(): Promise<CumulativeUsage> {
    return { gCO2e: 1.5, since: new Date('2026-09-01T00:00:00Z') };
  }
  async allTime(): Promise<CumulativeUsage> {
    return { gCO2e: 1.5, since: new Date('2026-09-01T00:00:00Z') };
  }
  async snapshot(): Promise<UsageHistorySnapshot> {
    return { daily: this.daily, cumulative: await this.cumulative(), allTime: await this.allTime() };
  }
  async reset(): Promise<void> {}
  async clear(): Promise<void> {
    this.cleared = true;
    this.daily = {};
  }
}

class ScriptedConfirmation implements Confirmation {
  requests: ConfirmationRequest[] = [];
  constructor(public answer = true) {}
  async ask(request: ConfirmationRequest): Promise<boolean> {
    this.requests.push(request);
    return this.answer;
  }
}

class RecordingFileSaver implements FileSaver {
  files: { filename: string; content: string; mimeType: string }[] = [];
  save(filename: string, content: string, mimeType: string): void {
    this.files.push({ filename, content, mimeType });
  }
}

interface Harness {
  settings: InMemorySettingsRepository;
  conversations: InMemoryConversationRepository;
  usageHistory: InMemoryUsageHistoryRepository;
  confirmation: ScriptedConfirmation;
  files: RecordingFileSaver;
}

async function mount(settings: Settings = DEFAULT_SETTINGS, answer = true): Promise<Harness> {
  document.documentElement.innerHTML = OPTIONS_HTML.replace(/<script[^>]*><\/script>/, '');
  const harness: Harness = {
    settings: new InMemorySettingsRepository(settings),
    conversations: new InMemoryConversationRepository(),
    usageHistory: new InMemoryUsageHistoryRepository(),
    confirmation: new ScriptedConfirmation(answer),
    files: new RecordingFileSaver(),
  };
  await new OptionsPage({
    doc: document,
    messages: new StubMessages(),
    settings: harness.settings,
    conversations: harness.conversations,
    usageHistory: harness.usageHistory,
    models: ModelRegistry.fromCatalog(CATALOG),
    confirmation: harness.confirmation,
    files: harness.files,
    version: '1.0.0',
    methodologyUrl: 'chrome-extension://id/methodology.html',
  }).start();
  return harness;
}

function radio(name: string, value: string): HTMLInputElement {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!;
}

function pick(name: string, value: string): void {
  const input = radio(name, value);
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function coefficientInput(model: string, coefficient: string): HTMLInputElement {
  return document.querySelector<HTMLInputElement>(`input[data-model="${model}"][data-coefficient="${coefficient}"]`)!;
}

function status(): string {
  return document.getElementById('status')?.textContent ?? '';
}

describe('OptionsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('translates every [data-i18n] element and the title, and points the methodology link at the extension page', async () => {
    await mount();
    expect(document.title).toBe('optionsTitle');
    expect(document.querySelector('h1')?.textContent).toBe('optionsTitle');
    expect(document.querySelectorAll('[data-i18n]:empty')).toHaveLength(0);
    expect(document.querySelector<HTMLAnchorElement>('#methodology-link')?.href).toBe('chrome-extension://id/methodology.html');
  });

  it('reflects the stored settings in the radios, leaving location unchecked while unanswered', async () => {
    await mount({ ...DEFAULT_SETTINGS, language: 'en', gridReference: 'french-mix' });
    expect(radio('language', 'en').checked).toBe(true);
    expect(radio('gridReference', 'french-mix').checked).toBe(true);
    expect(radio('userLocation', 'fr').checked).toBe(false);
    expect(radio('userLocation', 'other').checked).toBe(false);
  });

  it('saves language and grid reference on change, keeping the other fields', async () => {
    const h = await mount({ ...DEFAULT_SETTINGS, equivalenceId: 'plane-km' });
    pick('language', 'fr');
    await flush();
    pick('gridReference', 'french-mix');
    await flush();
    expect(h.settings.settings).toEqual({
      ...DEFAULT_SETTINGS,
      equivalenceId: 'plane-km',
      language: 'fr',
      gridReference: 'french-mix',
    });
    expect(status()).toBe('optionsSaved');
  });

  it('confirms a location change first, and reverts the radio when declined', async () => {
    const declined = await mount({ ...DEFAULT_SETTINGS, userLocation: 'other' }, false);
    pick('userLocation', 'fr');
    await flush();
    expect(declined.confirmation.requests[0]?.message).toBe('locationChangeWarning');
    expect(declined.settings.settings.userLocation).toBe('other');
    expect(radio('userLocation', 'other').checked).toBe(true);

    const accepted = await mount({ ...DEFAULT_SETTINGS, userLocation: 'other' }, true);
    pick('userLocation', 'fr');
    await flush();
    expect(accepted.settings.settings.userLocation).toBe('fr');
  });

  it('builds one row per catalogue model with the defaults as placeholders and stored overrides as values', async () => {
    await mount({ ...DEFAULT_SETTINGS, coefficientOverrides: { 'gpt-mid': { pue: 1.2 } } });
    expect(document.querySelectorAll('#coefficients-body tr')).toHaveLength(2);
    expect(document.querySelectorAll('#coefficients-head th')).toHaveLength(6);
    expect(coefficientInput('claude-frontier', 'eTokenWh').placeholder).toBe('0.0005');
    expect(coefficientInput('claude-frontier', 'eTokenWh').value).toBe('');
    expect(coefficientInput('gpt-mid', 'pue').value).toBe('1.2');
    expect(coefficientInput('gpt-mid', 'pue').getAttribute('aria-label')).toContain('GPT mid');
  });

  it('saves only the fields that were filled in, accepting a decimal comma', async () => {
    const h = await mount();
    coefficientInput('claude-frontier', 'pue').value = '1,2';
    coefficientInput('gpt-mid', 'uncertaintyFactor').value = ' 2 ';
    document.getElementById('save-coefficients')!.click();
    await flush();
    expect(h.settings.settings.coefficientOverrides).toEqual({
      'claude-frontier': { pue: 1.2 },
      'gpt-mid': { uncertaintyFactor: 2 },
    });
    expect(status()).toBe('optionsSaved');
  });

  it('refuses an invalid coefficient, names it, marks the field and saves nothing', async () => {
    const h = await mount();
    coefficientInput('claude-frontier', 'pue').value = '0.8'; // below the PUE floor of 1
    coefficientInput('gpt-mid', 'eTokenWh').value = '3e-4';
    document.getElementById('save-coefficients')!.click();
    await flush();
    expect(h.settings.saves).toBe(0);
    expect(status()).toBe('optionsInvalidCoefficient(optionsColPue|Claude frontier|1)');
    expect(coefficientInput('claude-frontier', 'pue').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(coefficientInput('claude-frontier', 'pue'));
  });

  it('"restore defaults" clears every override and every field', async () => {
    const h = await mount({ ...DEFAULT_SETTINGS, coefficientOverrides: { 'gpt-mid': { pue: 1.2 } } });
    document.getElementById('restore-defaults')!.click();
    await flush();
    expect(h.settings.settings.coefficientOverrides).toEqual({});
    expect(coefficientInput('gpt-mid', 'pue').value).toBe('');
  });

  it('exports JSON and both CSVs as downloads with dated names', async () => {
    const h = await mount();
    await h.conversations.save(
      new Conversation(
        'conv-1',
        'claude',
        Estimate.fromEnergyBreakdown({
          usage: new TokenUsage(10, 100, 0),
          energyWh: 0.05,
          electricityG: 0.02,
          embodiedG: 0.005,
          uncertaintyFactor: 3,
          confidence: 'modelled',
        }),
        1,
      ),
    );
    for (const id of ['export-json', 'export-conversations', 'export-daily']) {
      document.getElementById(id)!.click();
      await flush();
    }

    expect(h.files.files.map((f) => f.mimeType)).toEqual(['application/json', 'text/csv', 'text/csv']);
    expect(h.files.files[0]?.filename).toMatch(/^carbometre-\d{4}-\d{2}-\d{2}\.json$/);
    const bundle = JSON.parse(h.files.files[0]!.content) as { version: string; conversations: { id: string }[] };
    expect(bundle.version).toBe('1.0.0');
    expect(bundle.conversations[0]?.id).toBe('conv-1');
    expect(h.files.files[1]?.content).toContain('conv-1,claude,1,10,100,0,0.05,');
    expect(h.files.files[2]?.content).toBe('day,gCO2e\n2026-09-15,1.5\n');
  });

  it('erases every total only after confirmation, and never the settings', async () => {
    const declined = await mount(DEFAULT_SETTINGS, false);
    await declined.conversations.save(new Conversation('c', 'claude'));
    document.getElementById('erase-data')!.click();
    await flush();
    expect(declined.conversations.store.size).toBe(1);
    expect(declined.usageHistory.cleared).toBe(false);

    const accepted = await mount({ ...DEFAULT_SETTINGS, language: 'fr' }, true);
    await accepted.conversations.save(new Conversation('c', 'claude'));
    document.getElementById('erase-data')!.click();
    await flush();
    expect(accepted.conversations.store.size).toBe(0);
    expect(accepted.usageHistory.cleared).toBe(true);
    expect(accepted.settings.settings.language).toBe('fr');
    expect(status()).toBe('optionsEraseDone');
  });
});

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
