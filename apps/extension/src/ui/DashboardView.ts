import {
  EQUIVALENCE_IDS,
  type Estimate,
  type EquivalenceId,
  isEquivalenceId,
  isUserLocation,
  USER_LOCATIONS,
  type UserLocation,
} from '@carbometre/core';
import { EQUIVALENCE_MESSAGE_KEYS, MESSAGE_KEYS } from '../i18n/messageKeys.js';
import type { Messages } from '../i18n/Messages.js';
import type { CumulativeUsage } from '../storage/UsageHistoryRepository.js';
import { formatEmissions, formatEmissionsRange } from './formatEmissions.js';
import { formatQuantity } from './formatQuantity.js';
import { formatSinceDate } from './formatSinceDate.js';

const PANEL_CLASS = 'carbometre-dashboard';
const FOCUSABLE_SELECTOR = 'button, select, a[href], [tabindex]:not([tabindex="-1"])';
/** Value of the placeholder <option> shown while the location is still unanswered. */
const LOCATION_UNSET_VALUE = '';

export interface DashboardData {
  readonly conversationTotal: Estimate;
  /** Since the last reset - the headline cross-conversation figure. */
  readonly cumulative: CumulativeUsage;
  /** Since the extension was installed; never reset. Shown under "details". */
  readonly allTime: CumulativeUsage;
  /** Since the first day of the current month. Shown under "details". */
  readonly monthToDate: number;
  readonly equivalenceId: EquivalenceId;
  /** The cumulative total expressed in the chosen equivalence's units (km, hours). */
  readonly equivalentUnits: number;
  readonly userLocation: UserLocation | null;
}

/**
 * What the user can do from the panel. The view only reports; the presenter
 * decides what happens, then pushes fresh data back through update().
 */
export interface DashboardActions {
  onReset(): void;
  onEquivalenceChange(id: EquivalenceId): void;
  /**
   * A *request*: the presenter confirms it with the user first, then either
   * applies it or pushes the unchanged data back through update(), which
   * puts the select back where it was.
   */
  onUserLocationRequested(location: UserLocation): void;
}

/**
 * Floating panel opened by clicking the badge. Three numbers, the controls
 * that act on them, one methodology link. Self-contained: appends itself to
 * <body> (not next to the badge) so position:fixed can't be broken by a
 * transformed ancestor in the host page's own layout.
 */
export class DashboardView {
  private readonly panel: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly conversationValueEl: HTMLElement;
  private readonly conversationRangeEl: HTMLElement;
  private readonly cumulativeLabelEl: HTMLElement;
  private readonly cumulativeValueEl: HTMLElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly detailsButton: HTMLButtonElement;
  private readonly detailsEl: HTMLElement;
  private readonly sinceInstallEl: HTMLElement;
  private readonly monthToDateEl: HTMLElement;
  private readonly equivalentValueEl: HTMLElement;
  private readonly equivalenceSelect: HTMLSelectElement;
  private readonly locationSelect: HTMLSelectElement;
  private readonly locationUnsetOption: HTMLOptionElement;
  private openState = false;
  /** Reset is two clicks: the first arms the button, the second resets. */
  private resetArmed = false;
  private detailsOpen = false;
  /** The location last rendered, so re-selecting it is not reported as a change. */
  private renderedLocation: UserLocation | null = null;
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
    private readonly actions: DashboardActions,
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

    const cumulativeRow = this.buildRow('');
    this.cumulativeLabelEl = cumulativeRow.querySelector<HTMLElement>(`.${PANEL_CLASS}-label`)!;
    this.cumulativeValueEl = this.valueElOf(cumulativeRow);
    this.resetButton = doc.createElement('button');
    this.resetButton.type = 'button';
    this.resetButton.className = `${PANEL_CLASS}-reset`;
    this.resetButton.setAttribute('aria-label', messages.get(MESSAGE_KEYS.dashboardResetAriaLabel));
    this.resetButton.addEventListener('click', () => this.handleResetClick());
    this.disarmReset();
    this.detailsButton = doc.createElement('button');
    this.detailsButton.type = 'button';
    this.detailsButton.className = `${PANEL_CLASS}-details-toggle`;
    this.detailsButton.setAttribute('aria-expanded', 'false');
    this.detailsButton.addEventListener('click', () => this.toggleDetails());
    const cumulativeActions = doc.createElement('div');
    cumulativeActions.className = `${PANEL_CLASS}-actions`;
    cumulativeActions.append(this.resetButton, this.detailsButton);
    this.detailsEl = doc.createElement('dl');
    this.detailsEl.className = `${PANEL_CLASS}-details`;
    this.sinceInstallEl = this.buildDetail(this.detailsEl);
    this.monthToDateEl = this.buildDetail(this.detailsEl);
    this.setDetailsOpen(false);
    cumulativeRow.append(cumulativeActions, this.detailsEl);

    const equivalentRow = this.buildRow(messages.get(MESSAGE_KEYS.dashboardEquivalentLabel));
    this.equivalentValueEl = this.valueElOf(equivalentRow);
    this.equivalenceSelect = this.buildSelect(
      messages.get(MESSAGE_KEYS.equivalenceSelectLabel),
      EQUIVALENCE_IDS.map((id) => [id, messages.get(EQUIVALENCE_MESSAGE_KEYS[id].option)]),
    );
    this.equivalenceSelect.addEventListener('change', () => {
      const value = this.equivalenceSelect.value;
      if (isEquivalenceId(value)) {
        this.actions.onEquivalenceChange(value);
      }
    });
    equivalentRow.append(this.equivalenceSelect);

    const locationRow = this.buildRow(messages.get(MESSAGE_KEYS.dashboardLocationLabel));
    locationRow.querySelector(`.${PANEL_CLASS}-value`)?.remove();
    this.locationUnsetOption = doc.createElement('option');
    this.locationUnsetOption.value = LOCATION_UNSET_VALUE;
    this.locationUnsetOption.disabled = true;
    this.locationUnsetOption.textContent = messages.get(MESSAGE_KEYS.locationUnset);
    this.locationSelect = this.buildSelect(
      messages.get(MESSAGE_KEYS.locationSelectLabel),
      USER_LOCATIONS.map((location) => [location, messages.get(this.locationOptionKey(location))]),
    );
    this.locationSelect.prepend(this.locationUnsetOption);
    // Changing the location is deliberately not a one-click affair: past
    // estimates are never recomputed, and a user who does not know that
    // reads the unchanged totals as "the setting did nothing" (or, with a
    // new response in between, as "it went up"). The view only requests;
    // the presenter asks for confirmation.
    this.locationSelect.addEventListener('change', () => {
      const value = this.locationSelect.value;
      if (isUserLocation(value) && value !== this.renderedLocation) {
        this.actions.onUserLocationRequested(value);
      }
    });
    locationRow.append(this.locationSelect);

    const link = doc.createElement('a');
    link.className = `${PANEL_CLASS}-methodology-link`;
    link.href = methodologyUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = messages.get(MESSAGE_KEYS.dashboardMethodologyLink);

    this.panel.append(this.closeButton, conversationRow, cumulativeRow, equivalentRow, locationRow, link);
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

  /** Re-renders in place if open; a no-op otherwise (open() renders on its own). */
  update(data: DashboardData): void {
    if (this.openState) {
      this.render(data);
    }
  }

  /** Re-anchors to the trigger's current position - called as the badge is dragged. */
  follow(): void {
    if (this.openState && this.trigger) {
      this.position(this.trigger.getBoundingClientRect());
    }
  }

  close(): void {
    if (!this.openState) {
      return;
    }
    this.openState = false;
    this.disarmReset();
    this.setDetailsOpen(false);
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

    this.cumulativeLabelEl.textContent = this.messages.get(MESSAGE_KEYS.dashboardSinceLabel, [
      formatSinceDate(data.cumulative.since),
    ]);
    this.cumulativeValueEl.textContent = formatEmissions(data.cumulative.gCO2e);

    this.equivalenceSelect.value = data.equivalenceId;
    this.equivalentValueEl.textContent = this.messages.get(EQUIVALENCE_MESSAGE_KEYS[data.equivalenceId].value, [
      formatQuantity(data.equivalentUnits),
    ]);

    this.sinceInstallEl.textContent = `${this.messages.get(MESSAGE_KEYS.dashboardSinceInstallLabel, [
      formatSinceDate(data.allTime.since),
    ])} : ${formatEmissions(data.allTime.gCO2e)}`;
    this.monthToDateEl.textContent = `${this.messages.get(MESSAGE_KEYS.dashboardMonthToDateLabel)} : ${formatEmissions(
      data.monthToDate,
    )}`;

    this.renderedLocation = data.userLocation;
    this.locationUnsetOption.hidden = data.userLocation !== null;
    this.locationSelect.value = data.userLocation ?? LOCATION_UNSET_VALUE;
  }

  private toggleDetails(): void {
    this.setDetailsOpen(!this.detailsOpen);
  }

  private setDetailsOpen(open: boolean): void {
    this.detailsOpen = open;
    this.detailsEl.hidden = !open;
    this.detailsButton.setAttribute('aria-expanded', String(open));
    this.detailsButton.textContent = this.messages.get(
      open ? MESSAGE_KEYS.dashboardDetailsHideLabel : MESSAGE_KEYS.dashboardDetailsLabel,
    );
  }

  private handleResetClick(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetButton.textContent = this.messages.get(MESSAGE_KEYS.dashboardResetConfirmLabel);
      this.resetButton.classList.add(`${PANEL_CLASS}-reset--armed`);
      return;
    }
    this.disarmReset();
    this.actions.onReset();
  }

  private disarmReset(): void {
    this.resetArmed = false;
    this.resetButton.textContent = this.messages.get(MESSAGE_KEYS.dashboardResetLabel);
    this.resetButton.classList.remove(`${PANEL_CLASS}-reset--armed`);
  }

  private locationOptionKey(location: UserLocation): string {
    return location === 'fr' ? MESSAGE_KEYS.locationOptionFr : MESSAGE_KEYS.locationOptionOther;
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

  private buildDetail(list: HTMLElement): HTMLElement {
    const item = this.doc.createElement('dd');
    item.className = `${PANEL_CLASS}-detail`;
    list.append(item);
    return item;
  }

  private buildSelect(ariaLabel: string, options: ReadonlyArray<readonly [value: string, label: string]>): HTMLSelectElement {
    const select = this.doc.createElement('select');
    select.className = `${PANEL_CLASS}-select`;
    select.setAttribute('aria-label', ariaLabel);
    for (const [value, label] of options) {
      const option = this.doc.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    return select;
  }

  private valueElOf(row: HTMLDivElement): HTMLElement {
    const el = row.querySelector<HTMLElement>(`.${PANEL_CLASS}-value`);
    if (!el) {
      throw new Error('DashboardView: row built without a value element');
    }
    return el;
  }
}
