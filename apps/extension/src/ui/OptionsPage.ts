import {
  COEFFICIENT_MINIMUMS,
  type CoefficientOverride,
  type CoefficientOverrides,
  EDITABLE_COEFFICIENTS,
  type EditableCoefficient,
  isGridReference,
  isUserLocation,
  type ModelProfile,
  type ModelRegistry,
} from '@carbometre/core';
import { buildExportBundle, conversationsCsv, dailyCsv, toJson } from '../export/UsageExport.js';
import { COEFFICIENT_MESSAGE_KEYS, MESSAGE_KEYS } from '../i18n/messageKeys.js';
import type { Messages } from '../i18n/Messages.js';
import { isUiLanguage } from '../i18n/UiLanguage.js';
import type { ConversationRepository } from '../storage/ConversationRepository.js';
import type { Settings, SettingsRepository } from '../storage/SettingsRepository.js';
import type { UsageHistoryRepository } from '../storage/UsageHistoryRepository.js';
import type { Confirmation } from './Confirmation.js';
import type { FileSaver } from './FileSaver.js';

export interface OptionsPageDependencies {
  readonly doc: Document;
  readonly messages: Messages;
  readonly settings: SettingsRepository;
  readonly conversations: ConversationRepository;
  readonly usageHistory: UsageHistoryRepository;
  readonly models: ModelRegistry;
  readonly confirmation: Confirmation;
  readonly files: FileSaver;
  readonly version: string;
  readonly methodologyUrl: string;
}

/**
 * Drives options.html. The markup is static (MV3 forbids inline scripts),
 * this class fills the [data-i18n] texts, builds the coefficient table
 * from the catalogue, and wires every control to the repositories. Each
 * section saves on its own; there is no global "save" button to forget.
 */
export class OptionsPage {
  private readonly doc: Document;
  private readonly messages: Messages;
  private settings: Settings | null = null;

  constructor(private readonly deps: OptionsPageDependencies) {
    this.doc = deps.doc;
    this.messages = deps.messages;
  }

  async start(): Promise<void> {
    this.translate();
    this.settings = await this.deps.settings.load();
    this.buildCoefficientTable();
    this.renderSettings(this.settings);
    this.wireRadios('language', (value) => {
      if (isUiLanguage(value)) {
        void this.save({ language: value });
      }
    });
    this.wireRadios('gridReference', (value) => {
      if (isGridReference(value)) {
        void this.save({ gridReference: value });
      }
    });
    this.wireRadios('userLocation', (value) => {
      if (isUserLocation(value)) {
        void this.requestLocationChange(value);
      }
    });
    this.byId<HTMLButtonElement>('save-coefficients').addEventListener('click', () => void this.saveCoefficients());
    this.byId<HTMLButtonElement>('restore-defaults').addEventListener('click', () => void this.restoreDefaults());
    this.byId<HTMLButtonElement>('export-json').addEventListener('click', () => void this.exportJson());
    this.byId<HTMLButtonElement>('export-conversations').addEventListener('click', () => void this.exportConversations());
    this.byId<HTMLButtonElement>('export-daily').addEventListener('click', () => void this.exportDaily());
    this.byId<HTMLButtonElement>('erase-data').addEventListener('click', () => void this.eraseData());
    const methodology = this.byId<HTMLAnchorElement>('methodology-link');
    methodology.href = this.deps.methodologyUrl;
  }

  private translate(): void {
    for (const el of this.doc.querySelectorAll<HTMLElement>('[data-i18n]')) {
      const key = el.dataset.i18n;
      if (key) {
        el.textContent = this.messages.get(key);
      }
    }
    this.doc.title = this.messages.get(MESSAGE_KEYS.optionsTitle);
  }

  private renderSettings(settings: Settings): void {
    this.checkRadio('language', settings.language);
    this.checkRadio('gridReference', settings.gridReference);
    this.checkRadio('userLocation', settings.userLocation ?? '');
    this.renderOverrides(settings.coefficientOverrides);
  }

  private async save(patch: Partial<Settings>): Promise<void> {
    const next: Settings = { ...(this.settings ?? (await this.deps.settings.load())), ...patch };
    this.settings = next;
    await this.deps.settings.save(next);
    this.setStatus(this.messages.get(MESSAGE_KEYS.optionsSaved));
  }

  private async requestLocationChange(value: Settings['userLocation']): Promise<void> {
    const confirmed = await this.deps.confirmation.ask({
      title: this.messages.get(MESSAGE_KEYS.locationChangeTitle),
      message: this.messages.get(MESSAGE_KEYS.locationChangeWarning),
      confirmLabel: this.messages.get(MESSAGE_KEYS.locationChangeConfirmLabel),
      cancelLabel: this.messages.get(MESSAGE_KEYS.cancelLabel),
    });
    if (confirmed) {
      await this.save({ userLocation: value });
    } else {
      this.checkRadio('userLocation', this.settings?.userLocation ?? '');
    }
  }

  // --- coefficients -------------------------------------------------------

  private buildCoefficientTable(): void {
    const head = this.byId<HTMLTableRowElement>('coefficients-head');
    head.replaceChildren(this.cell('th', this.messages.get(MESSAGE_KEYS.optionsColModel)));
    for (const coefficient of EDITABLE_COEFFICIENTS) {
      head.append(this.cell('th', this.messages.get(COEFFICIENT_MESSAGE_KEYS[coefficient])));
    }

    const body = this.byId<HTMLTableSectionElement>('coefficients-body');
    body.replaceChildren();
    for (const profile of this.deps.models.defaults()) {
      const row = this.doc.createElement('tr');
      const label = this.cell('th', profile.label);
      label.scope = 'row';
      row.append(label);
      for (const coefficient of EDITABLE_COEFFICIENTS) {
        row.append(this.coefficientCell(profile, coefficient));
      }
      body.append(row);
    }
  }

  private coefficientCell(profile: ModelProfile, coefficient: EditableCoefficient): HTMLTableCellElement {
    const td = this.doc.createElement('td');
    const input = this.doc.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.dataset.model = profile.id;
    input.dataset.coefficient = coefficient;
    const defaultValue = String(profile[coefficient]);
    input.placeholder = defaultValue;
    const hint = this.messages.get(MESSAGE_KEYS.optionsDefaultValue, [defaultValue]);
    input.title = hint;
    input.setAttribute(
      'aria-label',
      `${profile.label} – ${this.messages.get(COEFFICIENT_MESSAGE_KEYS[coefficient])} (${hint})`,
    );
    td.append(input);
    return td;
  }

  private coefficientInputs(): HTMLInputElement[] {
    return Array.from(this.doc.querySelectorAll<HTMLInputElement>('#coefficients-body input[data-model]'));
  }

  private renderOverrides(overrides: CoefficientOverrides): void {
    for (const input of this.coefficientInputs()) {
      const value = overrides[input.dataset.model ?? '']?.[input.dataset.coefficient as EditableCoefficient];
      input.value = value === undefined ? '' : String(value);
    }
  }

  /**
   * An empty field means "use the default"; anything else must parse as a
   * number at or above the coefficient's minimum. One invalid field
   * blocks the whole save, with the offending model and column named.
   */
  private async saveCoefficients(): Promise<void> {
    const overrides: Record<string, CoefficientOverride> = {};
    const labels = new Map(this.deps.models.defaults().map((profile) => [profile.id, profile.label]));
    for (const input of this.coefficientInputs()) {
      const modelId = input.dataset.model ?? '';
      const coefficient = input.dataset.coefficient as EditableCoefficient;
      const raw = input.value.trim();
      input.removeAttribute('aria-invalid');
      if (raw === '') {
        continue;
      }
      const value = Number(raw.replace(',', '.'));
      if (!Number.isFinite(value) || value < COEFFICIENT_MINIMUMS[coefficient]) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        this.setStatus(
          this.messages.get(MESSAGE_KEYS.optionsInvalidCoefficient, [
            this.messages.get(COEFFICIENT_MESSAGE_KEYS[coefficient]),
            labels.get(modelId) ?? modelId,
            String(COEFFICIENT_MINIMUMS[coefficient]),
          ]),
          true,
        );
        return;
      }
      (overrides[modelId] ??= {})[coefficient] = value;
    }
    await this.save({ coefficientOverrides: overrides });
    this.renderOverrides(overrides);
  }

  private async restoreDefaults(): Promise<void> {
    await this.save({ coefficientOverrides: {} });
    this.renderOverrides({});
  }

  // --- data ---------------------------------------------------------------

  private async exportJson(): Promise<void> {
    const [conversations, history] = await Promise.all([
      this.deps.conversations.all(),
      this.deps.usageHistory.snapshot(),
    ]);
    const settings = this.settings ?? (await this.deps.settings.load());
    const bundle = buildExportBundle(conversations, history, settings, this.deps.version);
    this.deps.files.save(`carbometre-${this.dateStamp()}.json`, toJson(bundle), 'application/json');
  }

  private async exportConversations(): Promise<void> {
    const conversations = await this.deps.conversations.all();
    const settings = this.settings ?? (await this.deps.settings.load());
    const history = await this.deps.usageHistory.snapshot();
    const bundle = buildExportBundle(conversations, history, settings, this.deps.version);
    this.deps.files.save(
      `carbometre-conversations-${this.dateStamp()}.csv`,
      conversationsCsv(bundle.conversations),
      'text/csv',
    );
  }

  private async exportDaily(): Promise<void> {
    const history = await this.deps.usageHistory.snapshot();
    this.deps.files.save(`carbometre-daily-${this.dateStamp()}.csv`, dailyCsv(history.daily), 'text/csv');
  }

  private async eraseData(): Promise<void> {
    const confirmed = await this.deps.confirmation.ask({
      title: this.messages.get(MESSAGE_KEYS.optionsEraseDataTitle),
      message: this.messages.get(MESSAGE_KEYS.optionsEraseDataWarning),
      confirmLabel: this.messages.get(MESSAGE_KEYS.optionsEraseData),
      cancelLabel: this.messages.get(MESSAGE_KEYS.cancelLabel),
    });
    if (!confirmed) {
      return;
    }
    await Promise.all([this.deps.conversations.clear(), this.deps.usageHistory.clear()]);
    this.setStatus(this.messages.get(MESSAGE_KEYS.optionsEraseDone));
  }

  // --- helpers ------------------------------------------------------------

  private wireRadios(name: string, onChange: (value: string) => void): void {
    for (const radio of this.doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`)) {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          onChange(radio.value);
        }
      });
    }
  }

  private checkRadio(name: string, value: string): void {
    for (const radio of this.doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`)) {
      radio.checked = radio.value === value;
    }
  }

  private setStatus(text: string, isError = false): void {
    const status = this.byId<HTMLElement>('status');
    status.textContent = text;
    status.classList.toggle('error', isError);
  }

  private cell(tag: 'th' | 'td', text: string): HTMLTableCellElement {
    const el = this.doc.createElement(tag);
    el.textContent = text;
    return el;
  }

  private byId<T extends HTMLElement>(id: string): T {
    const el = this.doc.getElementById(id);
    if (!el) {
      throw new Error(`OptionsPage: missing #${id} in options.html`);
    }
    return el as T;
  }

  private dateStamp(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
