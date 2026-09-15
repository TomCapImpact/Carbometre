/**
 * The one message the content script sends to the service worker. A
 * content script has no chrome.runtime.openOptionsPage; the worker does.
 */
export const OPEN_OPTIONS_MESSAGE = { type: 'carbometre:open-options' } as const;

export function isOpenOptionsMessage(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === OPEN_OPTIONS_MESSAGE.type
  );
}
