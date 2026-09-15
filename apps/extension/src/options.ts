import { resolveMessages } from './i18n/resolveMessages.js';
import { ChromeStorageSettingsRepository } from './storage/ChromeStorageSettingsRepository.js';
import { OptionsPage } from './ui/OptionsPage.js';

async function main(): Promise<void> {
  const settings = new ChromeStorageSettingsRepository();
  const { language } = await settings.load();
  await new OptionsPage({
    doc: document,
    messages: resolveMessages(language),
    settings,
    methodologyUrl: chrome.runtime.getURL('methodology.html'),
  }).start();
}

main().catch((error: unknown) => {
  console.error('[Carbomètre] options page failed to start', error);
});
