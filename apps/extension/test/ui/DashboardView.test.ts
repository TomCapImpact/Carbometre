import { Estimate, TokenUsage } from '@carbometre/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Messages } from '../../src/i18n/Messages.js';
import { type DashboardActions, type DashboardData, DashboardView } from '../../src/ui/DashboardView.js';

class StubMessages implements Messages {
  get(key: string, substitutions?: string[]): string {
    return substitutions ? `${key}(${substitutions.join(',')})` : key;
  }
}

function buildTotal(): Estimate {
  return Estimate.fromEnergyBreakdown({
    usage: new TokenUsage(50, 500, 0),
    energyWh: 0.2814,
    electricityG: 0.104118,
    embodiedG: 0.0246225,
    uncertaintyFactor: 3,
    confidence: 'modelled',
  });
}

const METHODOLOGY_URL = 'https://example.invalid/methodology.html';

function noopActions(): DashboardActions {
  return { onReset: vi.fn(), onEquivalenceChange: vi.fn(), onUserLocationRequested: vi.fn() };
}

function emptyData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    conversationTotal: Estimate.zero(),
    cumulative: { gCO2e: 0, since: new Date('2026-09-15T10:00:00Z') },
    allTime: { gCO2e: 0, since: new Date('2026-09-01T10:00:00Z') },
    monthToDate: 0,
    equivalenceId: 'car-km',
    equivalentUnits: 0,
    userLocation: 'other',
    ...overrides,
  };
}

function build(actions: DashboardActions = noopActions()): DashboardView {
  return new DashboardView(document, new StubMessages(), METHODOLOGY_URL, actions);
}

describe('DashboardView', () => {
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = '<button id="trigger">badge</button>';
    trigger = document.getElementById('trigger') as HTMLButtonElement;
  });

  afterEach(() => {
    document.querySelectorAll('.carbometre-dashboard').forEach((el) => el.remove());
  });

  it('starts hidden and appended to the body, not next to the trigger', () => {
    build();
    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;

    expect(panel).not.toBeNull();
    expect(panel.hidden).toBe(true);
    expect(panel.parentElement).toBe(document.body);
  });

  it('renders the three numbers, the since-date and the methodology link on open', () => {
    const dashboard = build();
    dashboard.open(
      trigger,
      emptyData({
        conversationTotal: buildTotal(),
        cumulative: { gCO2e: 4.2, since: new Date('2026-09-15T10:00:00Z') },
        equivalenceId: 'plane-km',
        equivalentUnits: 0.0163,
      }),
    );

    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;
    expect(panel.hidden).toBe(false);
    const values = panel.querySelectorAll('.carbometre-dashboard-value');
    expect(values[0]?.textContent).toBe('0.13 gCO2e');
    expect(values[1]?.textContent).toBe('4.20 gCO2e');
    expect(values[2]?.textContent).toBe('equivalentValuePlaneKm(0.016)');
    expect(panel.querySelector('.carbometre-dashboard-range')?.textContent).toContain('gCO2e');
    const labels = Array.from(panel.querySelectorAll('.carbometre-dashboard-label')).map((el) => el.textContent);
    expect(labels[1]).toMatch(/^dashboardSinceLabel\(.*2026.*\)$/);
    const link = panel.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe(METHODOLOGY_URL);
    expect(link.target).toBe('_blank');
  });

  it('update() re-renders in place while open and is a no-op while closed', () => {
    const dashboard = build();
    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;
    const cumulativeValue = (): string | null | undefined =>
      panel.querySelectorAll('.carbometre-dashboard-value')[1]?.textContent;

    dashboard.update(emptyData({ cumulative: { gCO2e: 9, since: new Date() } }));
    expect(cumulativeValue()).toBe(''); // never opened: nothing rendered

    dashboard.open(trigger, emptyData({ cumulative: { gCO2e: 1, since: new Date() } }));
    expect(cumulativeValue()).toBe('1.00 gCO2e');

    dashboard.update(emptyData({ cumulative: { gCO2e: 0, since: new Date() } }));
    expect(cumulativeValue()).toBe('0.00 gCO2e');
  });

  it('reset needs two clicks: the first arms the button, the second fires onReset', () => {
    const actions = noopActions();
    const dashboard = build(actions);
    dashboard.open(trigger, emptyData());
    const reset = document.querySelector('.carbometre-dashboard-reset') as HTMLButtonElement;

    expect(reset.textContent).toBe('dashboardResetLabel');
    reset.click();
    expect(actions.onReset).not.toHaveBeenCalled();
    expect(reset.textContent).toBe('dashboardResetConfirmLabel');

    reset.click();
    expect(actions.onReset).toHaveBeenCalledTimes(1);
    expect(reset.textContent).toBe('dashboardResetLabel'); // disarmed again
  });

  it('disarms a pending reset when the panel closes, so reopening never inherits a confirm state', () => {
    const actions = noopActions();
    const dashboard = build(actions);
    dashboard.open(trigger, emptyData());
    const reset = document.querySelector('.carbometre-dashboard-reset') as HTMLButtonElement;
    reset.click();
    dashboard.close();

    dashboard.open(trigger, emptyData());
    expect(reset.textContent).toBe('dashboardResetLabel');
    reset.click();
    expect(actions.onReset).not.toHaveBeenCalled();
  });

  it('reports an equivalence change through the action, and reflects the chosen one on render', () => {
    const actions = noopActions();
    const dashboard = build(actions);
    dashboard.open(trigger, emptyData({ equivalenceId: 'plane-km' }));
    const selects = document.querySelectorAll<HTMLSelectElement>('.carbometre-dashboard-select');
    const equivalenceSelect = selects[0]!;
    expect(equivalenceSelect.value).toBe('plane-km');
    expect(Array.from(equivalenceSelect.options).map((o) => o.value)).toEqual(['car-km', 'plane-km']);

    equivalenceSelect.value = 'car-km';
    equivalenceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(actions.onEquivalenceChange).toHaveBeenCalledWith('car-km');
  });

  it('does not fire an equivalence change twice for the same pick', () => {
    const actions = noopActions();
    const dashboard = build(actions);
    dashboard.open(trigger, emptyData({ equivalenceId: 'car-km' }));
    const equivalenceSelect = document.querySelector<HTMLSelectElement>('.carbometre-dashboard-select')!;

    equivalenceSelect.value = 'plane-km';
    equivalenceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(actions.onEquivalenceChange).toHaveBeenCalledWith('plane-km');
  });

  it('shows a disabled "not set" placeholder for the location until it is answered, then hides it', () => {
    const dashboard = build();
    dashboard.open(trigger, emptyData({ userLocation: null }));
    const locationSelect = document.querySelectorAll<HTMLSelectElement>('.carbometre-dashboard-select')[1]!;
    const placeholder = locationSelect.options[0]!;
    expect(placeholder.disabled).toBe(true);
    expect(placeholder.hidden).toBe(false);
    expect(locationSelect.value).toBe('');

    dashboard.update(emptyData({ userLocation: 'fr' }));
    expect(placeholder.hidden).toBe(true);
    expect(locationSelect.value).toBe('fr');
  });

  it('a location pick is only a request, and picking the rendered value again is not one', () => {
    const actions = noopActions();
    const dashboard = build(actions);
    dashboard.open(trigger, emptyData({ userLocation: 'other' }));
    const locationSelect = document.querySelectorAll<HTMLSelectElement>('.carbometre-dashboard-select')[1]!;

    locationSelect.value = 'other';
    locationSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(actions.onUserLocationRequested).not.toHaveBeenCalled();

    locationSelect.value = 'fr';
    locationSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(actions.onUserLocationRequested).toHaveBeenCalledWith('fr');
    // Nothing applied by the view itself: the presenter decides.
    expect(locationSelect.value).toBe('fr');

    // A declined request comes back as an update() with the old data, which reverts the select.
    dashboard.update(emptyData({ userLocation: 'other' }));
    expect(locationSelect.value).toBe('other');
  });

  it('follow() re-anchors the open panel to wherever the trigger has moved', () => {
    const dashboard = build();
    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;
    let rect = { top: 100, bottom: 120, left: 50, right: 130, width: 80, height: 20 };
    trigger.getBoundingClientRect = () => ({ ...rect, x: rect.left, y: rect.top, toJSON() {} }) as DOMRect;
    panel.getBoundingClientRect = () =>
      ({ top: 0, bottom: 100, left: 0, right: 200, width: 200, height: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;

    dashboard.open(trigger, emptyData());
    expect(panel.style.left).toBe('50px');
    expect(panel.style.top).toBe('128px'); // bottom + 8px margin

    rect = { top: 300, bottom: 320, left: 200, right: 280, width: 80, height: 20 };
    dashboard.follow();
    expect(panel.style.left).toBe('200px');
    expect(panel.style.top).toBe('328px');

    dashboard.close();
    rect = { top: 10, bottom: 30, left: 10, right: 90, width: 80, height: 20 };
    dashboard.follow(); // closed: must not touch styles
    expect(panel.style.left).toBe('200px');
  });

  it('"details" toggles the all-time and month-to-date totals, and closes with the panel', () => {
    const dashboard = build();
    dashboard.open(
      trigger,
      emptyData({
        allTime: { gCO2e: 12.5, since: new Date('2026-08-01T00:00:00Z') },
        monthToDate: 3.25,
      }),
    );
    const toggle = document.querySelector('.carbometre-dashboard-details-toggle') as HTMLButtonElement;
    const details = document.querySelector('.carbometre-dashboard-details') as HTMLElement;
    expect(details.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toBe('dashboardDetailsLabel');

    toggle.click();
    expect(details.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent).toBe('dashboardDetailsHideLabel');
    const lines = Array.from(details.querySelectorAll('.carbometre-dashboard-detail')).map((el) => el.textContent);
    expect(lines[0]).toMatch(/^dashboardSinceInstallLabel\(.*2026.*\) : 12\.50\u00a0gCO2e$/);
    expect(lines[1]).toBe('dashboardMonthToDateLabel : 3.25\u00a0gCO2e');

    dashboard.close();
    dashboard.open(trigger, emptyData());
    expect(details.hidden).toBe(true);
  });

  it('flips above the anchor when there is no room below (e.g. a bottom-anchored floating badge)', () => {
    const dashboard = build();
    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;

    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });
    // A trigger pinned near the bottom of a short viewport, like the
    // floating-badge fallback - and a panel tall enough that "below" would
    // push most of it off-screen.
    trigger.getBoundingClientRect = () =>
      ({ top: 370, bottom: 390, left: 300, right: 380, width: 80, height: 20, x: 300, y: 370, toJSON() {} }) as DOMRect;
    panel.getBoundingClientRect = () =>
      ({ top: 0, bottom: 150, left: 0, right: 0, width: 200, height: 150, x: 0, y: 0, toJSON() {} }) as DOMRect;

    try {
      dashboard.open(trigger, emptyData());
      const top = Number.parseFloat(panel.style.top);
      expect(top).toBeLessThan(370); // above the anchor's top, not below its bottom
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, configurable: true });
    }
  });

  it('right-aligns instead of left-aligning when the anchor is near the left edge (a draggable badge can end up anywhere)', () => {
    const dashboard = build();
    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;

    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    // A badge dragged near the left edge, and a panel wide enough that
    // left-aligning it with the badge would overflow the right edge.
    trigger.getBoundingClientRect = () =>
      ({ top: 100, bottom: 120, left: 10, right: 90, width: 80, height: 20, x: 10, y: 100, toJSON() {} }) as DOMRect;
    panel.getBoundingClientRect = () =>
      ({ top: 0, bottom: 0, left: 0, right: 0, width: 450, height: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;

    try {
      dashboard.open(trigger, emptyData());
      expect(panel.style.left).toBe('auto');
      expect(panel.style.right).not.toBe('auto');
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
    }
  });

  it('reports isOpen() accurately and toggles closed', () => {
    const dashboard = build();
    expect(dashboard.isOpen()).toBe(false);

    dashboard.open(trigger, emptyData());
    expect(dashboard.isOpen()).toBe(true);

    dashboard.close();
    expect(dashboard.isOpen()).toBe(false);
    expect((document.querySelector('.carbometre-dashboard') as HTMLElement).hidden).toBe(true);
  });

  it('closes on Escape and returns focus to whatever was focused before opening', () => {
    const dashboard = build();
    trigger.focus();
    dashboard.open(trigger, emptyData());

    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(dashboard.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when clicking outside the panel and the trigger', () => {
    const dashboard = build();
    dashboard.open(trigger, emptyData());

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dashboard.isOpen()).toBe(false);
  });

  it('does not close when the click is on the trigger itself (the badge owns that click)', () => {
    const dashboard = build();
    dashboard.open(trigger, emptyData());

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dashboard.isOpen()).toBe(true);
  });

  it('does not close when clicking inside the panel', () => {
    const dashboard = build();
    dashboard.open(trigger, emptyData());

    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;
    panel.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dashboard.isOpen()).toBe(true);
  });

  it('traps Tab focus between the close button and the methodology link', () => {
    const dashboard = build();
    dashboard.open(trigger, emptyData());

    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;
    const closeButton = panel.querySelector('.carbometre-dashboard-close') as HTMLElement;
    const link = panel.querySelector('a') as HTMLElement;

    expect(document.activeElement).toBe(closeButton); // focused on open

    link.focus();
    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    panel.dispatchEvent(tabForward);
    expect(tabForward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);

    closeButton.focus();
    const tabBackward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    panel.dispatchEvent(tabBackward);
    expect(tabBackward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(link);
  });

  it('destroy() removes the panel from the document', () => {
    const dashboard = build();
    dashboard.destroy();
    expect(document.querySelector('.carbometre-dashboard')).toBeNull();
  });
});
