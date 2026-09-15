import { isOpenOptionsMessage } from './background/messages.js';

/**
 * The extension's only background code, and it does two things:
 *  - open the onboarding question once, when first installed
 *    (chrome.runtime.onInstalled is only reachable from a service worker);
 *  - open the Options page when the dashboard asks, since a content
 *    script cannot call chrome.runtime.openOptionsPage itself.
 * No alarms, no network, no state.
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isOpenOptionsMessage(message)) {
    void chrome.runtime.openOptionsPage();
  }
});
