import { MESSAGE_KEYS } from '../i18n/messageKeys.js';
import type { Messages } from '../i18n/Messages.js';
import { formatEmissions } from './formatEmissions.js';

const BADGE_CLASS_NAME = 'carbometre-badge';
const DRAGGING_CLASS_NAME = `${BADGE_CLASS_NAME}--dragging`;
const POSITION_STORAGE_KEY = 'carbometre:badgePosition';
/** Pointer movement below this, in px, is a click; at or above it, a drag. */
const DRAG_THRESHOLD_PX = 4;

interface DragState {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly originLeft: number;
  readonly originTop: number;
  moved: boolean;
}

/**
 * The whole v1 UI: one real <button> showing the running total for the
 * current conversation - a floating, draggable bubble (Messenger-style)
 * rather than blended into any site's header, so it works identically
 * regardless of a site's DOM and survives that DOM changing under it.
 * Position is remembered per site via localStorage.
 */
export class BadgeView {
  private readonly button: HTMLButtonElement;
  private dragState: DragState | null = null;
  private suppressNextClick = false;
  /**
   * The position last applied via applyPosition(), tracked directly rather
   * than re-derived from getBoundingClientRect() at drop time: real layout
   * can lag a style write by a frame, and a stubbed layout engine (as in
   * tests) may not reflect inline styles in its rect at all.
   */
  private currentPosition: { left: number; top: number } | null = null;

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }
    const dx = event.clientX - this.dragState.startX;
    const dy = event.clientY - this.dragState.startY;
    if (!this.dragState.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      this.dragState.moved = true;
      this.button.classList.add(DRAGGING_CLASS_NAME);
    }
    if (this.dragState.moved) {
      this.applyPosition(this.dragState.originLeft + dx, this.dragState.originTop + dy);
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }
    const { moved } = this.dragState;
    this.button.releasePointerCapture?.(event.pointerId);
    this.button.removeEventListener('pointermove', this.handlePointerMove);
    this.button.removeEventListener('pointerup', this.handlePointerUp);
    this.button.classList.remove(DRAGGING_CLASS_NAME);
    this.dragState = null;
    if (moved && this.currentPosition) {
      this.savePosition(this.currentPosition.left, this.currentPosition.top);
      this.suppressNextClick = true;
    }
  };

  constructor(
    private readonly doc: Document,
    private readonly messages: Messages,
    private readonly onActivate: () => void,
  ) {
    this.button = doc.createElement('button');
    this.button.type = 'button';
    this.button.className = BADGE_CLASS_NAME;
    this.button.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    this.button.addEventListener('click', (event) => this.handleClick(event));
  }

  mount(): void {
    this.doc.body.append(this.button);
    this.restorePosition();
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

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return; // primary button/touch only
    }
    const rect = this.button.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      moved: false,
    };
    this.button.setPointerCapture?.(event.pointerId);
    this.button.addEventListener('pointermove', this.handlePointerMove);
    this.button.addEventListener('pointerup', this.handlePointerUp);
  }

  private handleClick(event: MouseEvent): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.onActivate();
  }

  private applyPosition(left: number, top: number): void {
    const win = this.doc.defaultView;
    const maxLeft = Math.max(0, (win?.innerWidth ?? left) - this.button.offsetWidth);
    const maxTop = Math.max(0, (win?.innerHeight ?? top) - this.button.offsetHeight);
    const clampedLeft = Math.min(Math.max(0, left), maxLeft);
    const clampedTop = Math.min(Math.max(0, top), maxTop);
    this.button.style.left = `${clampedLeft}px`;
    this.button.style.top = `${clampedTop}px`;
    this.button.style.right = 'auto';
    this.button.style.bottom = 'auto';
    this.currentPosition = { left: clampedLeft, top: clampedTop };
  }

  private savePosition(left: number, top: number): void {
    try {
      this.doc.defaultView?.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ left, top }));
    } catch {
      // A remembered position is a nice-to-have; localStorage can throw in
      // restrictive contexts (private browsing, exhausted quota) and that's
      // not worth surfacing as an error.
    }
  }

  private restorePosition(): void {
    try {
      const raw = this.doc.defaultView?.localStorage.getItem(POSITION_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'left' in parsed &&
        'top' in parsed &&
        typeof parsed.left === 'number' &&
        typeof parsed.top === 'number'
      ) {
        this.applyPosition(parsed.left, parsed.top);
      }
    } catch {
      // Corrupt or inaccessible storage - keep the CSS default position.
    }
  }
}
