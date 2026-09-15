import { isUserLocation } from '@carbometre/core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Messages } from '../../src/i18n/Messages.js';
import { DEFAULT_SETTINGS } from '../../src/storage/ChromeStorageSettingsRepository.js';
import type { Settings, SettingsRepository } from '../../src/storage/SettingsRepository.js';
import { OnboardingPage } from '../../src/ui/OnboardingPage.js';

class StubMessages implements Messages {
  get(key: string): string {
    return `msg:${key}`;
  }
}

class InMemorySettingsRepository implements SettingsRepository {
  settings: Settings = { ...DEFAULT_SETTINGS, equivalenceId: 'plane-km' };
  async load(): Promise<Settings> {
    return this.settings;
  }
  async save(settings: Settings): Promise<void> {
    this.settings = settings;
  }
}

const MARKUP = `
  <h1 data-i18n="onboardingTitle">placeholder</h1>
  <section data-step="question">
    <button type="button" data-location="fr" data-i18n="locationOptionFr"></button>
    <button type="button" data-location="other" data-i18n="locationOptionOther"></button>
    <button type="button" data-location="mars">bogus</button>
  </section>
  <section data-step="done" hidden tabindex="-1"><p data-i18n="onboardingDone"></p></section>
`;

describe('OnboardingPage', () => {
  let settings: InMemorySettingsRepository;

  beforeEach(() => {
    document.body.innerHTML = MARKUP;
    settings = new InMemorySettingsRepository();
    new OnboardingPage(document, new StubMessages(), settings, isUserLocation).start();
  });

  it('fills every [data-i18n] element from the catalog', () => {
    expect(document.querySelector('h1')?.textContent).toBe('msg:onboardingTitle');
    expect(document.querySelector('[data-location="fr"]')?.textContent).toBe('msg:locationOptionFr');
    expect(document.title).toBe('msg:onboardingTitle');
  });

  it('saves the chosen location without clobbering other settings, then swaps to the confirmation', async () => {
    (document.querySelector('[data-location="fr"]') as HTMLButtonElement).click();
    await flushMicrotasks();

    expect(settings.settings).toEqual({ ...DEFAULT_SETTINGS, userLocation: 'fr', equivalenceId: 'plane-km' });
    expect((document.querySelector('[data-step="question"]') as HTMLElement).hidden).toBe(true);
    expect((document.querySelector('[data-step="done"]') as HTMLElement).hidden).toBe(false);
  });

  it('ignores a button whose data-location is not a known value', async () => {
    (document.querySelector('[data-location="mars"]') as HTMLButtonElement).click();
    await flushMicrotasks();
    expect(settings.settings.userLocation).toBeNull();
    expect((document.querySelector('[data-step="question"]') as HTMLElement).hidden).toBe(false);
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
