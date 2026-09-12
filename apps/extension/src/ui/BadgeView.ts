import { MESSAGE_KEYS } from '../i18n/messageKeys.js';
import type { Messages } from '../i18n/Messages.js';
import { formatEmissions } from './formatEmissions.js';

const BADGE_CLASS_NAME = 'carbometre-badge';

/**
 * The whole v1 UI: one real <button> showing the running total for the
 * current conversation. No label, no icon, no colour coding - see
 * carbometre-claude-code-prompt.md "Badge" section.
 */
export class BadgeView {
  private readonly button: HTMLButtonElement;

  constructor(
    private readonly doc: Document,
    private readonly messages: Messages,
    onActivate: () => void,
  ) {
    this.button = doc.createElement('button');
    this.button.type = 'button';
    this.button.className = BADGE_CLASS_NAME;
    this.button.addEventListener('click', onActivate);
  }

  /** Inserts the badge immediately before `anchor` (e.g. the site's own overflow menu). */
  mount(anchor: Element): void {
    anchor.insertAdjacentElement('beforebegin', this.button);
  }

  unmount(): void {
    this.button.remove();
  }

  isMounted(): boolean {
    return this.doc.contains(this.button);
  }

  /** The underlying button - e.g. so DashboardView can exclude it from "click outside to close". */
  get element(): HTMLButtonElement {
    return this.button;
  }

  render(gCO2e: number): void {
    const text = formatEmissions(gCO2e);
    this.button.textContent = text;
    this.button.setAttribute('aria-label', this.messages.get(MESSAGE_KEYS.badgeAriaLabel, [text]));
  }

  showUnavailable(): void {
    this.button.textContent = '--';
    this.button.setAttribute('aria-label', this.messages.get(MESSAGE_KEYS.badgeUnavailableAriaLabel));
  }
}
