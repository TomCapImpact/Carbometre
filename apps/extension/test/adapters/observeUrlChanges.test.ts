import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeUrlChanges } from '../../src/adapters/observeUrlChanges.js';

/**
 * A minimal stand-in for `Window` covering only what observeUrlChanges
 * uses. Real jsdom windows don't allow reassigning `location.href` outside
 * of an actual navigation, which is exactly the "site bypassed our patch"
 * scenario this fallback needs to be tested against.
 */
function buildFakeWindow() {
  const listeners = new Map<string, Set<EventListener>>();
  const win = {
    location: { href: 'https://example.test/' },
    history: {
      pushState: vi.fn(),
      replaceState: vi.fn(),
    },
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener);
    }),
    setInterval: (...args: Parameters<typeof setInterval>) => setInterval(...args),
    clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
  };

  return {
    win: win as unknown as Window,
    fireEvent: (type: string) => {
      for (const listener of listeners.get(type) ?? []) {
        listener(new Event(type));
      }
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('observeUrlChanges', () => {
  it('fires on pushState', () => {
    const { win } = buildFakeWindow();
    const onChange = vi.fn();
    observeUrlChanges(onChange, win);

    win.location.href = 'https://example.test/next';
    win.history.pushState({}, '', '/next');

    expect(onChange).toHaveBeenCalledOnce();
  });

  it('fires on popstate', () => {
    const { win, fireEvent } = buildFakeWindow();
    const onChange = vi.fn();
    observeUrlChanges(onChange, win);

    win.location.href = 'https://example.test/back';
    fireEvent('popstate');

    expect(onChange).toHaveBeenCalledOnce();
  });

  it('falls back to polling when the URL changes without going through the patched pushState/replaceState (the confirmed chatgpt.com case)', () => {
    const { win } = buildFakeWindow();
    const onChange = vi.fn();
    observeUrlChanges(onChange, win);

    // Simulate a router that bypassed our patch entirely, e.g. because it
    // captured a reference to the native history.pushState before this
    // module ran - onChange should still fire, just on the next poll tick.
    win.location.href = 'https://example.test/via-native-router';
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('does not fire when the URL has not actually changed', () => {
    const { win } = buildFakeWindow();
    const onChange = vi.fn();
    observeUrlChanges(onChange, win);

    vi.advanceTimersByTime(2000);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops all detection (patches restored, listeners removed, polling stopped) once unsubscribed', () => {
    const { win, fireEvent } = buildFakeWindow();
    const onChange = vi.fn();
    const stop = observeUrlChanges(onChange, win);

    stop();

    // pushState/replaceState no longer trigger onChange as a side effect.
    win.location.href = 'https://example.test/via-pushstate-after-stop';
    win.history.pushState({}, '', '/via-pushstate-after-stop');
    expect(onChange).not.toHaveBeenCalled();

    // Neither does popstate, nor the poll.
    win.location.href = 'https://example.test/after-unsubscribe';
    fireEvent('popstate');
    vi.advanceTimersByTime(2000);

    expect(onChange).not.toHaveBeenCalled();
  });
});
