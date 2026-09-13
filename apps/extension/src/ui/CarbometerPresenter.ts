import { type CarbometerService, Conversation, Estimate, gCO2eToCarKm } from '@carbometre/core';
import { observeUrlChanges } from '../adapters/observeUrlChanges.js';
import type { RawResponse, SiteAdapter } from '../adapters/SiteAdapter.js';
import { resolveUiLanguage } from '../i18n/resolveUiLanguage.js';
import type { Messages } from '../i18n/Messages.js';
import type { ConversationRepository } from '../storage/ConversationRepository.js';
import type { UsageHistoryRepository } from '../storage/UsageHistoryRepository.js';
import type { Unsubscribe } from '../types.js';
import { BadgeView } from './BadgeView.js';
import { DashboardView } from './DashboardView.js';

const DASHBOARD_WINDOW_DAYS = 30;
/**
 * Passed to the service when the site's model picker can't be read, so
 * ModelRegistry falls through to the adapter's fallback tier. Any id that
 * isn't in the catalog works; this one just reads clearly in a stack trace.
 */
const UNKNOWN_MODEL_ID = 'unknown-model';

/**
 * Holds the service and repositories, feeds the badge and dashboard. This is
 * the only class that knows how "a finished response" turns into "the badge
 * shows a new number" - adapters just report DOM events, the service just
 * does math. The badge itself is a floating, draggable bubble (see
 * BadgeView) rather than anchored into any site's header, so there is
 * nothing site-specific to wait for or fall back from here.
 */
export class CarbometerPresenter {
  private readonly dashboard: DashboardView;
  private readonly badge: BadgeView;
  private conversation: Conversation | null = null;
  private lastConversationId: string | null = null;
  private stopObservingResponses: Unsubscribe | null = null;
  private stopObservingUrl: Unsubscribe | null = null;

  constructor(
    private readonly adapter: SiteAdapter,
    private readonly service: CarbometerService,
    private readonly repository: ConversationRepository,
    private readonly usageHistory: UsageHistoryRepository,
    private readonly messages: Messages,
    methodologyUrl: string,
    private readonly doc: Document = document,
  ) {
    this.dashboard = new DashboardView(doc, messages, methodologyUrl);
    this.badge = new BadgeView(doc, messages, () => this.runDetached(this.toggleDashboard()));
  }

  start(): void {
    this.badge.mount();
    this.renderBadge();
    this.stopObservingUrl = observeUrlChanges(() => this.runDetached(this.handleConversationChange()));
    this.stopObservingResponses = this.adapter.observeResponses((response) =>
      this.runDetached(this.handleResponse(response)),
    );
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

  private async toggleDashboard(): Promise<void> {
    if (this.dashboard.isOpen()) {
      this.dashboard.close();
      return;
    }
    const conversationTotal = this.conversation?.total ?? Estimate.zero();
    const last30DaysGCO2e = await this.usageHistory.totalForLastDays(DASHBOARD_WINDOW_DAYS);
    this.dashboard.open(this.badge.element, {
      conversationTotal,
      last30DaysGCO2e,
      equivalentKm: gCO2eToCarKm(last30DaysGCO2e),
    });
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

    this.conversation = id ? (await this.repository.load(id)) ?? new Conversation(id, this.adapter.providerId) : null;
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
    await Promise.all([this.repository.save(this.conversation), this.usageHistory.record(estimate.gCO2e)]);
  }
}
