import { MESSAGE_KEYS } from '../i18n/messageKeys.js';
import type { Messages } from '../i18n/Messages.js';
import { isUiLanguage } from '../i18n/UiLanguage.js';
import type { Settings, SettingsRepository } from '../storage/SettingsRepository.js';

export interface OptionsPageDependencies {
  readonly doc: Document;
  readonly messages: Messages;
  readonly settings: SettingsRepository;
  readonly methodologyUrl: string;
}

/**
 * Drives options.html. v1 deliberately exposes one setting here - the
 * interface language - so the page cannot intimidate anyone. Location is
 * asked at install and changed from the dashboard; the electricity
 * reference, coefficient editing and data export exist in the git history
 * (commit "Options page: language, location, electricity reference, ...")
 * and come back when there is a reason to.
 */
export class OptionsPage {
  private settings: Settings | null = null;

  constructor(private readonly deps: OptionsPageDependencies) {}

  async start(): Promise<void> {
    this.translate();
    this.settings = await this.deps.settings.load();
    this.checkRadio('language', this.settings.language);
    for (const radio of this.deps.doc.querySelectorAll<HTMLInputElement>('input[type="radio"][name="language"]')) {
      radio.addEventListener('change', () => {
        if (radio.checked && isUiLanguage(radio.value)) {
          void this.save({ language: radio.value });
        }
      });
    }
    this.byId<HTMLAnchorElement>('methodology-link').href = this.deps.methodologyUrl;
  }

  private translate(): void {
    for (const el of this.deps.doc.querySelectorAll<HTMLElement>('[data-i18n]')) {
      const key = el.dataset.i18n;
      if (key) {
        el.textContent = this.deps.messages.get(key);
      }
    }
    this.deps.doc.title = this.deps.messages.get(MESSAGE_KEYS.optionsTitle);
  }

  private async save(patch: Partial<Settings>): Promise<void> {
    const next: Settings = { ...(this.settings ?? (await this.deps.settings.load())), ...patch };
    this.settings = next;
    await this.deps.settings.save(next);
    this.byId<HTMLElement>('status').textContent = this.deps.messages.get(MESSAGE_KEYS.optionsSaved);
  }

  private checkRadio(name: string, value: string): void {
    for (const radio of this.deps.doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`)) {
      radio.checked = radio.value === value;
    }
  }

  private byId<T extends HTMLElement>(id: string): T {
    const el = this.deps.doc.getElementById(id);
    if (!el) {
      throw new Error(`OptionsPage: missing #${id} in options.html`);
    }
    return el as T;
  }
}
