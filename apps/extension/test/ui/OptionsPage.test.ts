import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Messages } from '../../src/i18n/Messages.js';
import { DEFAULT_SETTINGS } from '../../src/storage/ChromeStorageSettingsRepository.js';
import type { Settings, SettingsRepository } from '../../src/storage/SettingsRepository.js';
import { OptionsPage } from '../../src/ui/OptionsPage.js';

/** The real markup: a missing id or attribute must fail here, not in the browser. */
const OPTIONS_HTML = readFileSync(resolve(process.cwd(), 'options.html'), 'utf8');

class StubMessages implements Messages {
  get(key: string): string {
    return key;
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
}

async function mount(settings: Settings = DEFAULT_SETTINGS): Promise<InMemorySettingsRepository> {
  document.documentElement.innerHTML = OPTIONS_HTML.replace(/<script[^>]*><\/script>/, '');
  const repository = new InMemorySettingsRepository(settings);
  await new OptionsPage({
    doc: document,
    messages: new StubMessages(),
    settings: repository,
    methodologyUrl: 'chrome-extension://id/methodology.html',
  }).start();
  return repository;
}

function radio(value: string): HTMLInputElement {
  return document.querySelector<HTMLInputElement>(`input[name="language"][value="${value}"]`)!;
}

describe('OptionsPage', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
  });

  it('translates every [data-i18n] element and the title, and points the methodology link at the extension page', async () => {
    await mount();
    expect(document.title).toBe('optionsTitle');
    expect(document.querySelectorAll('[data-i18n]:empty')).toHaveLength(0);
    expect(document.querySelector<HTMLAnchorElement>('#methodology-link')?.href).toBe(
      'chrome-extension://id/methodology.html',
    );
  });

  it('exposes exactly one setting in v1: the interface language', async () => {
    await mount();
    const names = new Set(Array.from(document.querySelectorAll('input')).map((input) => input.name));
    expect([...names]).toEqual(['language']);
    expect(Array.from(document.querySelectorAll<HTMLInputElement>('input[name="language"]')).map((r) => r.value)).toEqual([
      'auto',
      'fr',
      'en',
    ]);
  });

  it('reflects the stored language and saves a change without touching the other settings', async () => {
    const repository = await mount({ ...DEFAULT_SETTINGS, language: 'en', userLocation: 'fr', equivalenceId: 'plane-km' });
    expect(radio('en').checked).toBe(true);

    radio('fr').checked = true;
    radio('fr').dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));

    expect(repository.saves).toBe(1);
    expect(repository.settings).toEqual({ userLocation: 'fr', equivalenceId: 'plane-km', language: 'fr' });
    expect(document.getElementById('status')?.textContent).toBe('optionsSaved');
  });
});
