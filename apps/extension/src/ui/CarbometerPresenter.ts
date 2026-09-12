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
 * Holds the service and repositories, feeds the badge and dashboard. This is
 * the only class that knows how "a finished response" turns into "the badge
 * shows a new number" - adapters just report DOM events, the service just
 * does math.
 */
export class CarbometerPresenter {
  private readonly dashboard: DashboardView;
  private badge: BadgeView | null = null;
  private conversation: Conversation | null = null;
  private lastConversationId: string | null = null;
  private stopObservingResponses: Unsubscribe | null = null;
  private stopObservingUrl: Unsubscribe | null = null;
  private badgeWaiter: MutationObserver | null = null;

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
  }

  start(): void {
    this.ensureBadgeMounted();
    this.stopObservingUrl = observeUrlChanges(() => void this.handleConversationChange());
    this.stopObservingResponses = this.adapter.observeResponses((response) => void this.handleResponse(response));
    void this.handleConversationChange();
  }

  stop(): void {
    this.stopObservingResponses?.();
    this.stopObservingUrl?.();
    this.badgeWaiter?.disconnect();
    this.badge?.unmount();
    this.dashboard.destroy();
  }

  private ensureBadgeMounted(): void {
    if (this.badge?.isMounted()) {
      return;
    }
    const anchor = this.adapter.badgeAnchor();
    if (anchor) {
      this.attachBadge(anchor);
      return;
    }
    // The header can render asynchronously after the content script loads;
    // watch the page until the anchor shows up, then stop watching.
    this.badgeWaiter?.disconnect();
    this.badgeWaiter = new MutationObserver(() => {
      const found = this.adapter.badgeAnchor();
      if (found) {
        this.badgeWaiter?.disconnect();
        this.attachBadge(found);
      }
    });
    this.badgeWaiter.observe(this.doc.body, { childList: true, subtree: true });
  }

  private attachBadge(anchor: HTMLElement): void {
    this.badge = new BadgeView(this.doc, this.messages, () => void this.toggleDashboard());
    this.badge.mount(anchor);
    this.renderBadge();
  }

  private async toggleDashboard(): Promise<void> {
    if (!this.badge) {
      return;
    }
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
    if (!this.badge) {
      return;
    }
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
    this.ensureBadgeMounted();
    this.renderBadge();
  }

  private async handleResponse(response: RawResponse): Promise<void> {
    if (!this.conversation) {
      await this.handleConversationChange();
      if (!this.conversation) {
        return;
      }
    }

    const modelId = this.adapter.detectModelId();
    if (!modelId) {
      // We can't honestly estimate a response from a model we can't identify -
      // leave the running total as-is rather than guessing.
      this.ensureBadgeMounted();
      this.renderBadge();
      return;
    }

    const estimate = this.service.estimate({
      modelId,
      promptText: response.promptText,
      responseText: response.responseText,
      lang: resolveUiLanguage(),
      ...(response.visibleThinkingText ? { visibleThinkingText: response.visibleThinkingText } : {}),
    });

    this.conversation.addEstimate(estimate);
    this.ensureBadgeMounted();
    this.renderBadge();
    await Promise.all([this.repository.save(this.conversation), this.usageHistory.record(estimate.gCO2e)]);
  }
}
