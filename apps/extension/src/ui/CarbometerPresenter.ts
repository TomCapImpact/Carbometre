import {
  type CarbometerService,
  Conversation,
  type EquivalenceCatalog,
  type EquivalenceId,
  Estimate,
  type UserLocation,
} from '@carbometre/core';
import type { CalculationSettingsSink } from '../calculation/CalculationSettingsSink.js';
import { observeUrlChanges } from '../adapters/observeUrlChanges.js';
import type { RawResponse, SiteAdapter } from '../adapters/SiteAdapter.js';
import { MESSAGE_KEYS } from '../i18n/messageKeys.js';
import { resolveUiLanguage } from '../i18n/resolveUiLanguage.js';
import type { Messages } from '../i18n/Messages.js';
import type { ConversationRepository } from '../storage/ConversationRepository.js';
import { DEFAULT_SETTINGS } from '../storage/ChromeStorageSettingsRepository.js';
import type { Settings, SettingsRepository } from '../storage/SettingsRepository.js';
import type { UsageHistoryRepository } from '../storage/UsageHistoryRepository.js';
import type { Unsubscribe } from '../types.js';
import { BadgeView } from './BadgeView.js';
import type { Confirmation } from './Confirmation.js';
import { type DashboardData, DashboardView } from './DashboardView.js';

/**
 * Passed to the service when the site's model picker can't be read, so
 * ModelRegistry falls through to the adapter's fallback tier. Any id that
 * isn't in the catalog works; this one just reads clearly in a stack trace.
 */
const UNKNOWN_MODEL_ID = 'unknown-model';

/** UTC, to match the usage ledger's UTC calendar days. */
function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Everything the presenter is wired with, named - nine positional arguments stopped being readable. */
export interface PresenterDependencies {
  readonly adapter: SiteAdapter;
  readonly service: CarbometerService;
  readonly conversations: ConversationRepository;
  readonly usageHistory: UsageHistoryRepository;
  readonly settings: SettingsRepository;
  /** Receives the settings that change future estimates (today: the user's location). */
  readonly calculation: CalculationSettingsSink;
  readonly equivalences: EquivalenceCatalog;
  readonly confirmation: Confirmation;
  readonly messages: Messages;
  readonly methodologyUrl: string;
  /** Opens the Options page; the content script cannot do that itself. */
  readonly openOptions: () => void;
  readonly doc?: Document;
}

/**
 * Holds the service and repositories, feeds the badge and dashboard. This is
 * the only class that knows how "a finished response" turns into "the badge
 * shows a new number" - adapters just report DOM events, the service just
 * does math. The badge itself is a floating, draggable bubble (see
 * BadgeView) rather than anchored into any site's header, so there is
 * nothing site-specific to wait for or fall back from here.
 */
export class CarbometerPresenter {
  private readonly adapter: SiteAdapter;
  private readonly service: CarbometerService;
  private readonly conversations: ConversationRepository;
  private readonly usageHistory: UsageHistoryRepository;
  private readonly settingsRepository: SettingsRepository;
  private readonly calculation: CalculationSettingsSink;
  private readonly equivalences: EquivalenceCatalog;
  private readonly confirmation: Confirmation;
  private readonly messages: Messages;
  private readonly dashboard: DashboardView;
  private readonly badge: BadgeView;
  private settings: Settings = DEFAULT_SETTINGS;
  private conversation: Conversation | null = null;
  private lastConversationId: string | null = null;
  private stopObservingResponses: Unsubscribe | null = null;
  private stopObservingUrl: Unsubscribe | null = null;

  constructor(deps: PresenterDependencies) {
    this.adapter = deps.adapter;
    this.service = deps.service;
    this.conversations = deps.conversations;
    this.usageHistory = deps.usageHistory;
    this.settingsRepository = deps.settings;
    this.calculation = deps.calculation;
    this.equivalences = deps.equivalences;
    this.confirmation = deps.confirmation;
    this.messages = deps.messages;
    const doc = deps.doc ?? document;
    this.dashboard = new DashboardView(doc, deps.messages, deps.methodologyUrl, {
      onReset: () => this.runDetached(this.resetCumulative()),
      onEquivalenceChange: (id) => this.runDetached(this.changeEquivalence(id)),
      onUserLocationRequested: (location) => this.runDetached(this.requestUserLocationChange(location)),
      onOpenOptions: deps.openOptions,
    });
    this.badge = new BadgeView(
      doc,
      deps.messages,
      () => this.runDetached(this.toggleDashboard()),
      () => this.dashboard.follow(),
    );
  }

  start(): void {
    this.badge.mount();
    this.renderBadge();
    this.stopObservingUrl = observeUrlChanges(() => this.runDetached(this.handleConversationChange()));
    this.stopObservingResponses = this.adapter.observeResponses((response) =>
      this.runDetached(this.handleResponse(response)),
    );
    this.runDetached(this.loadSettings());
    this.runDetached(this.handleConversationChange());
  }

  stop(): void {
    this.stopObservingResponses?.();
    this.stopObservingUrl?.();
    this.badge.unmount();
    this.dashboard.destroy();
  }

  /**
   * Fire-and-forget entry points (event callbacks) can't `await` their
   * result, so a rejection inside them would otherwise vanish as a silent
   * unhandled rejection - logging it here is the difference between "the
   * badge is stuck for a reason we can see" and "the badge is just stuck".
   */
  private runDetached(promise: Promise<void>): void {
    promise.catch((error: unknown) => {
      console.error('[Carbomètre] unexpected error', error);
    });
  }

  private async loadSettings(): Promise<void> {
    this.applySettings(await this.settingsRepository.load());
  }

  private applySettings(settings: Settings): void {
    this.settings = settings;
    this.calculation.apply(settings);
  }

  private async saveSettings(settings: Settings): Promise<void> {
    this.applySettings(settings);
    await this.settingsRepository.save(settings);
    await this.refreshDashboard();
  }

  private async toggleDashboard(): Promise<void> {
    if (this.dashboard.isOpen()) {
      this.dashboard.close();
      return;
    }
    this.dashboard.open(this.badge.element, await this.dashboardData());
  }

  private async refreshDashboard(): Promise<void> {
    if (this.dashboard.isOpen()) {
      this.dashboard.update(await this.dashboardData());
    }
  }

  private async dashboardData(now: Date = new Date()): Promise<DashboardData> {
    const [cumulative, allTime, monthToDate] = await Promise.all([
      this.usageHistory.cumulative(now),
      this.usageHistory.allTime(now),
      this.usageHistory.totalSince(startOfUtcMonth(now)),
    ]);
    const equivalence = this.equivalences.resolve(this.settings.equivalenceId);
    return {
      conversationTotal: this.conversation?.total ?? Estimate.zero(),
      cumulative,
      allTime,
      monthToDate,
      equivalenceId: equivalence.id,
      equivalentUnits: equivalence.unitsFor(cumulative.gCO2e),
      userLocation: this.settings.userLocation,
    };
  }

  private async resetCumulative(): Promise<void> {
    await this.usageHistory.reset();
    await this.refreshDashboard();
  }

  private changeEquivalence(equivalenceId: EquivalenceId): Promise<void> {
    return this.saveSettings({ ...this.settings, equivalenceId });
  }

  /**
   * Confirmed in a modal because the consequence is easy to misread: past
   * estimates are never recalculated, so the totals will not move. On
   * cancel the dashboard is re-rendered, which puts the select back.
   */
  private async requestUserLocationChange(userLocation: UserLocation): Promise<void> {
    const confirmed = await this.confirmation.ask({
      title: this.messages.get(MESSAGE_KEYS.locationChangeTitle),
      message: this.messages.get(MESSAGE_KEYS.locationChangeWarning),
      confirmLabel: this.messages.get(MESSAGE_KEYS.locationChangeConfirmLabel),
      cancelLabel: this.messages.get(MESSAGE_KEYS.locationChangeCancelLabel),
    });
    if (confirmed) {
      await this.saveSettings({ ...this.settings, userLocation });
    } else {
      await this.refreshDashboard();
    }
  }

  private renderBadge(): void {
    if (this.conversation) {
      this.badge.render(this.conversation.total.gCO2e);
    } else {
      this.badge.showUnavailable();
    }
  }

  private async handleConversationChange(): Promise<void> {
    const id = this.adapter.currentConversationId();
    if (id === this.lastConversationId) {
      return;
    }
    this.lastConversationId = id;

    this.conversation = id ? (await this.conversations.load(id)) ?? new Conversation(id, this.adapter.providerId) : null;
    this.renderBadge();
  }

  private async handleResponse(response: RawResponse): Promise<void> {
    if (!this.conversation) {
      await this.handleConversationChange();
      if (!this.conversation) {
        return;
      }
    }

    // A model we can't identify is estimated against the adapter's fallback
    // tier rather than dropped: the resulting Estimate carries
    // confidence: 'guessed', which is the honest way to say "counted, but
    // we're less sure". Dropping it silently froze the badge instead.
    const modelId = this.adapter.detectModelId();
    const estimate = this.service.estimate({
      modelId: modelId ?? UNKNOWN_MODEL_ID,
      promptText: response.promptText,
      responseText: response.responseText,
      lang: resolveUiLanguage(),
      fallback: this.adapter.fallbackModel(),
      ...(response.visibleThinkingText ? { visibleThinkingText: response.visibleThinkingText } : {}),
    });

    this.conversation.addEstimate(estimate);
    this.renderBadge();
    await Promise.all([this.conversations.save(this.conversation), this.usageHistory.record(estimate.gCO2e)]);
    await this.refreshDashboard();
  }
}
