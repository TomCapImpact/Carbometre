import type { Estimate } from '@carbometre/core';
import { MESSAGE_KEYS } from '../i18n/messageKeys.js';
import type { Messages } from '../i18n/Messages.js';
import { formatDistance } from './formatDistance.js';
import { formatEmissions, formatEmissionsRange } from './formatEmissions.js';

const PANEL_CLASS = 'carbometre-dashboard';
const FOCUSABLE_SELECTOR = 'button, a[href], [tabindex]:not([tabindex="-1"])';

export interface DashboardData {
  readonly conversationTotal: Estimate;
  readonly last30DaysGCO2e: number;
  readonly equivalentKm: number;
}

/**
 * Floating panel opened by clicking the badge. Three numbers, one
 * methodology link, nothing else - see "Dashboard" in
 * carbometre-claude-code-prompt.md. Self-contained: appends itself to
 * <body> (not next to the badge) so position:fixed can't be broken by a
 * transformed ancestor in the host page's own layout.
 */
export class DashboardView {
  private readonly panel: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly conversationValueEl: HTMLElement;
  private readonly conversationRangeEl: HTMLElement;
  private readonly last30ValueEl: HTMLElement;
  private readonly equivalentValueEl: HTMLElement;
  private openState = false;
  private trigger: HTMLElement | null = null;
  private lastFocused: HTMLElement | null = null;

  private readonly handleOutsideClick = (event: MouseEvent): void => {
    const target = event.target as Node;
    if (!this.panel.contains(target) && !this.trigger?.contains(target)) {
      this.close();
    }
  };

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = Array.from(this.panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && this.doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  constructor(
    private readonly doc: Document,
    private readonly messages: Messages,
    methodologyUrl: string,
  ) {
    this.panel = doc.createElement('div');
    this.panel.className = PANEL_CLASS;
    this.panel.role = 'dialog';
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-label', messages.get(MESSAGE_KEYS.dashboardTitle));
    this.panel.hidden = true;
    this.panel.tabIndex = -1;
    this.panel.addEventListener('keydown', this.handleKeydown);

    this.closeButton = doc.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = `${PANEL_CLASS}-close`;
    this.closeButton.setAttribute('aria-label', messages.get(MESSAGE_KEYS.dashboardCloseLabel));
    this.closeButton.textContent = '×';
    this.closeButton.addEventListener('click', () => this.close());

    const conversationRow = this.buildRow(messages.get(MESSAGE_KEYS.dashboardConversationLabel));
    conversationRow.title = messages.get(MESSAGE_KEYS.dashboardConversationTooltip);
    this.conversationValueEl = this.valueElOf(conversationRow);
    this.conversationRangeEl = doc.createElement('div');
    this.conversationRangeEl.className = `${PANEL_CLASS}-range`;
    conversationRow.append(this.conversationRangeEl);

    const last30Row = this.buildRow(messages.get(MESSAGE_KEYS.dashboardLast30DaysLabel));
    this.last30ValueEl = this.valueElOf(last30Row);

    const equivalentRow = this.buildRow(messages.get(MESSAGE_KEYS.dashboardEquivalentLabel));
    this.equivalentValueEl = this.valueElOf(equivalentRow);

    const link = doc.createElement('a');
    link.className = `${PANEL_CLASS}-methodology-link`;
    link.href = methodologyUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = messages.get(MESSAGE_KEYS.dashboardMethodologyLink);

    this.panel.append(this.closeButton, conversationRow, last30Row, equivalentRow, link);
    doc.body.append(this.panel);
  }

  isOpen(): boolean {
    return this.openState;
  }

  open(trigger: HTMLElement, data: DashboardData): void {
    this.trigger = trigger;
    this.render(data);
    // Unhide before measuring: a hidden element's height is always 0, and
    // position() needs the real height to know whether it fits below the
    // anchor (e.g. the floating-badge fallback sits at the bottom of the
    // viewport, where there's no room underneath it).
    this.panel.hidden = false;
    this.position(trigger.getBoundingClientRect());
    this.openState = true;
    this.lastFocused = this.doc.activeElement as HTMLElement | null;
    this.closeButton.focus();
    this.doc.addEventListener('click', this.handleOutsideClick);
  }

  close(): void {
    if (!this.openState) {
      return;
    }
    this.openState = false;
    this.panel.hidden = true;
    this.doc.removeEventListener('click', this.handleOutsideClick);
    this.lastFocused?.focus();
  }

  destroy(): void {
    this.close();
    this.panel.remove();
  }

  private render(data: DashboardData): void {
    this.conversationValueEl.textContent = formatEmissions(data.conversationTotal.gCO2e);
    this.conversationRangeEl.textContent = formatEmissionsRange(
      data.conversationTotal.gCO2eLow,
      data.conversationTotal.gCO2eHigh,
    );
    this.last30ValueEl.textContent = formatEmissions(data.last30DaysGCO2e);

    const { amount, unit } = formatDistance(data.equivalentKm);
    this.equivalentValueEl.textContent = this.messages.get(MESSAGE_KEYS.dashboardEquivalentValue, [
      `${amount} ${unit}`,
    ]);
  }

  /**
   * Prefers just below and left-aligned with the anchor (badge), like a
   * normal dropdown, flipping to whichever side of each axis actually has
   * room. The badge is a user-draggable bubble that can end up anywhere on
   * screen (a corner, an edge), so both axes need this, not just vertical.
   */
  private position(anchorRect: DOMRect): void {
    const win = this.doc.defaultView;
    const viewportWidth = win?.innerWidth ?? anchorRect.right;
    const viewportHeight = win?.innerHeight ?? anchorRect.bottom;
    const margin = 8;

    this.panel.style.position = 'fixed';
    const panelRect = this.panel.getBoundingClientRect();

    const fitsLeftAligned = anchorRect.left + panelRect.width + margin <= viewportWidth;
    if (fitsLeftAligned) {
      this.panel.style.left = `${Math.max(margin, anchorRect.left)}px`;
      this.panel.style.right = 'auto';
    } else {
      this.panel.style.left = 'auto';
      this.panel.style.right = `${Math.max(margin, viewportWidth - anchorRect.right)}px`;
    }

    const fitsBelow = anchorRect.bottom + margin + panelRect.height <= viewportHeight;
    this.panel.style.top = fitsBelow
      ? `${anchorRect.bottom + margin}px`
      : `${Math.max(margin, anchorRect.top - margin - panelRect.height)}px`;
  }

  private buildRow(label: string): HTMLDivElement {
    const row = this.doc.createElement('div');
    row.className = `${PANEL_CLASS}-row`;
    const labelEl = this.doc.createElement('div');
    labelEl.className = `${PANEL_CLASS}-label`;
    labelEl.textContent = label;
    const valueEl = this.doc.createElement('div');
    valueEl.className = `${PANEL_CLASS}-value`;
    row.append(labelEl, valueEl);
    return row;
  }

  private valueElOf(row: HTMLDivElement): HTMLElement {
    const el = row.querySelector<HTMLElement>(`.${PANEL_CLASS}-value`);
    if (!el) {
      throw new Error('DashboardView: row built without a value element');
    }
    return el;
  }
}
