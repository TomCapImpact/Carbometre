/**
 * The extension's only background code. It exists for one reason: opening
 * the onboarding question once, when the extension is first installed.
 * chrome.runtime.onInstalled is only reachable from a service worker, not
 * from a content script. No listeners for anything else, no network, no
 * state.
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});
