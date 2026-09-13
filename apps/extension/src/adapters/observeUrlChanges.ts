import type { Unsubscribe } from '../types.js';

/**
 * How often the polling fallback re-checks location.href. Cheap (a string
 * comparison) and only needs to be fast enough that a badge reset feels
 * immediate to a human, not real-time.
 */
const POLL_INTERVAL_MS = 500;

/**
 * Single-page apps like Claude and ChatGPT change conversation without a
 * real navigation, so this needs to notice a URL change some other way.
 *
 * Patching history.pushState/replaceState (plus popstate) is the "proper"
 * approach, but it silently does nothing if the site's own router already
 * captured a reference to the native pushState before this content script
 * ran - confirmed on chatgpt.com (Claude's router doesn't have this issue,
 * so it worked there without the fallback). A plain interval poll doesn't
 * depend on winning that race, so it's kept as a always-on safety net
 * rather than the patch being the only mechanism.
 *
 * `win` is injected for testability.
 */
export function observeUrlChanges(onChange: () => void, win: Window = window): Unsubscribe {
  let lastHref = win.location.href;

  const check = (): void => {
    if (win.location.href !== lastHref) {
      lastHref = win.location.href;
      onChange();
    }
  };

  const originalPushState = win.history.pushState.bind(win.history);
  const originalReplaceState = win.history.replaceState.bind(win.history);

  win.history.pushState = ((...args: Parameters<History['pushState']>) => {
    originalPushState(...args);
    check();
  }) as History['pushState'];

  win.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
    originalReplaceState(...args);
    check();
  }) as History['replaceState'];

  win.addEventListener('popstate', check);
  const pollTimer = win.setInterval(check, POLL_INTERVAL_MS);

  return () => {
    win.history.pushState = originalPushState;
    win.history.replaceState = originalReplaceState;
    win.removeEventListener('popstate', check);
    win.clearInterval(pollTimer);
  };
}
