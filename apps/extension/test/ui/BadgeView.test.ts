import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Messages } from '../../src/i18n/Messages.js';
import { BadgeView } from '../../src/ui/BadgeView.js';

class StubMessages implements Messages {
  get(key: string, substitutions?: string[]): string {
    return substitutions ? `${key}(${substitutions.join(',')})` : key;
  }
}

function pointerEvent(type: string, init: Partial<PointerEventInit> = {}): PointerEvent {
  return new PointerEvent(type, { pointerId: 1, clientX: 0, clientY: 0, bubbles: true, ...init });
}

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('BadgeView', () => {
  it('mounts to the body as a real button', () => {
    const badge = new BadgeView(document, new StubMessages(), () => {});
    badge.mount();

    const el = document.querySelector('.carbometre-badge');
    expect(el).not.toBeNull();
    expect(el?.tagName).toBe('BUTTON');
    expect(el?.parentElement).toBe(document.body);
    expect(badge.isMounted()).toBe(true);
  });

  it('render() shows the formatted amount and an aria-label built from it', () => {
    const badge = new BadgeView(document, new StubMessages(), () => {});
    badge.mount();
    badge.render(1.2874);

    expect(badge.element.textContent).toBe('1.29 gCO2e');
    expect(badge.element.getAttribute('aria-label')).toContain('1.29');
  });

  it('showUnavailable() shows "--"', () => {
    const badge = new BadgeView(document, new StubMessages(), () => {});
    badge.mount();
    badge.showUnavailable();

    expect(badge.element.textContent).toBe('--');
  });

  it('unmount() removes the button', () => {
    const badge = new BadgeView(document, new StubMessages(), () => {});
    badge.mount();
    badge.unmount();

    expect(badge.isMounted()).toBe(false);
    expect(document.querySelector('.carbometre-badge')).toBeNull();
  });

  it('a plain click (no pointer movement) activates the callback', () => {
    const onActivate = vi.fn();
    const badge = new BadgeView(document, new StubMessages(), onActivate);
    badge.mount();

    badge.element.dispatchEvent(pointerEvent('pointerdown'));
    badge.element.dispatchEvent(pointerEvent('pointerup'));
    badge.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('dragging past the threshold repositions the badge and suppresses the resulting click', () => {
    const onActivate = vi.fn();
    const badge = new BadgeView(document, new StubMessages(), onActivate);
    badge.mount();

    badge.element.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    badge.element.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 130 })); // well past the 4px threshold
    expect(badge.element.classList.contains('carbometre-badge--dragging')).toBe(true);

    badge.element.dispatchEvent(pointerEvent('pointerup', { clientX: 140, clientY: 130 }));
    expect(badge.element.classList.contains('carbometre-badge--dragging')).toBe(false);

    // The click a real drag-and-release always fires after pointerup should be suppressed.
    badge.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onActivate).not.toHaveBeenCalled();

    // A later, unrelated click should activate normally again.
    badge.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('a movement below the drag threshold still counts as a click', () => {
    const onActivate = vi.fn();
    const badge = new BadgeView(document, new StubMessages(), onActivate);
    badge.mount();

    badge.element.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    badge.element.dispatchEvent(pointerEvent('pointermove', { clientX: 101, clientY: 100 })); // 1px, below threshold
    expect(badge.element.classList.contains('carbometre-badge--dragging')).toBe(false);

    badge.element.dispatchEvent(pointerEvent('pointerup', { clientX: 101, clientY: 100 }));
    badge.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('remembers a dragged position across a new BadgeView instance (localStorage)', () => {
    const first = new BadgeView(document, new StubMessages(), () => {});
    first.mount();

    first.element.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    first.element.dispatchEvent(pointerEvent('pointermove', { clientX: 250, clientY: 300 }));
    first.element.dispatchEvent(pointerEvent('pointerup', { clientX: 250, clientY: 300 }));

    const savedLeft = first.element.style.left;
    const savedTop = first.element.style.top;
    expect(savedLeft).not.toBe('');

    first.unmount();
    const second = new BadgeView(document, new StubMessages(), () => {});
    second.mount();

    expect(second.element.style.left).toBe(savedLeft);
    expect(second.element.style.top).toBe(savedTop);
  });

  it('falls back to the CSS default position when localStorage has nothing saved', () => {
    const badge = new BadgeView(document, new StubMessages(), () => {});
    badge.mount();

    expect(badge.element.style.left).toBe('');
    expect(badge.element.style.top).toBe('');
  });

  it('ignores corrupt localStorage data instead of throwing', () => {
    localStorage.setItem('carbometre:badgePosition', '{not valid json');
    expect(() => {
      const badge = new BadgeView(document, new StubMessages(), () => {});
      badge.mount();
    }).not.toThrow();
  });
});
