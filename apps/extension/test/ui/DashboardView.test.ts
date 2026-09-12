import { Estimate, TokenUsage } from '@carbometre/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Messages } from '../../src/i18n/Messages.js';
import { DashboardView } from '../../src/ui/DashboardView.js';

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
    new DashboardView(document, new StubMessages(), 'https://example.invalid/methodology.html');
    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;

    expect(panel).not.toBeNull();
    expect(panel.hidden).toBe(true);
    expect(panel.parentElement).toBe(document.body);
  });

  it('renders the three numbers and the methodology link on open', () => {
    const dashboard = new DashboardView(document, new StubMessages(), 'https://example.invalid/methodology.html');
    dashboard.open(trigger, { conversationTotal: buildTotal(), last30DaysGCO2e: 4.2, equivalentKm: 0.0336 });

    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('.carbometre-dashboard-value')?.textContent).toBe('0.1 gCO2e');
    expect(panel.querySelectorAll('.carbometre-dashboard-value')[1]?.textContent).toBe('4.2 gCO2e');
    expect(panel.querySelector('.carbometre-dashboard-range')?.textContent).toContain('gCO2e');
    const link = panel.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe('https://example.invalid/methodology.html');
    expect(link.target).toBe('_blank');
  });

  it('reports isOpen() accurately and toggles closed', () => {
    const dashboard = new DashboardView(document, new StubMessages(), 'https://example.invalid/methodology.html');
    expect(dashboard.isOpen()).toBe(false);

    dashboard.open(trigger, { conversationTotal: Estimate.zero(), last30DaysGCO2e: 0, equivalentKm: 0 });
    expect(dashboard.isOpen()).toBe(true);

    dashboard.close();
    expect(dashboard.isOpen()).toBe(false);
    expect((document.querySelector('.carbometre-dashboard') as HTMLElement).hidden).toBe(true);
  });

  it('closes on Escape and returns focus to whatever was focused before opening', () => {
    const dashboard = new DashboardView(document, new StubMessages(), 'https://example.invalid/methodology.html');
    trigger.focus();
    dashboard.open(trigger, { conversationTotal: Estimate.zero(), last30DaysGCO2e: 0, equivalentKm: 0 });

    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(dashboard.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when clicking outside the panel and the trigger', () => {
    const dashboard = new DashboardView(document, new StubMessages(), 'https://example.invalid/methodology.html');
    dashboard.open(trigger, { conversationTotal: Estimate.zero(), last30DaysGCO2e: 0, equivalentKm: 0 });

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dashboard.isOpen()).toBe(false);
  });

  it('does not close when the click is on the trigger itself (the badge owns that click)', () => {
    const dashboard = new DashboardView(document, new StubMessages(), 'https://example.invalid/methodology.html');
    dashboard.open(trigger, { conversationTotal: Estimate.zero(), last30DaysGCO2e: 0, equivalentKm: 0 });

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dashboard.isOpen()).toBe(true);
  });

  it('does not close when clicking inside the panel', () => {
    const dashboard = new DashboardView(document, new StubMessages(), 'https://example.invalid/methodology.html');
    dashboard.open(trigger, { conversationTotal: Estimate.zero(), last30DaysGCO2e: 0, equivalentKm: 0 });

    const panel = document.querySelector('.carbometre-dashboard') as HTMLElement;
    panel.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dashboard.isOpen()).toBe(true);
  });

  it('traps Tab focus between the close button and the methodology link', () => {
    const dashboard = new DashboardView(document, new StubMessages(), 'https://example.invalid/methodology.html');
    dashboard.open(trigger, { conversationTotal: Estimate.zero(), last30DaysGCO2e: 0, equivalentKm: 0 });

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
    const dashboard = new DashboardView(document, new StubMessages(), 'https://example.invalid/methodology.html');
    dashboard.destroy();
    expect(document.querySelector('.carbometre-dashboard')).toBeNull();
  });
});
