import type { Unsubscribe } from '../types.js';

/**
 * Single-page apps like Claude change conversation without a real
 * navigation, so we patch history.pushState/replaceState (and still listen
 * for popstate) to notice a URL change. `win` is injected for testability.
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

  return () => {
    win.history.pushState = originalPushState;
    win.history.replaceState = originalReplaceState;
    win.removeEventListener('popstate', check);
  };
}
