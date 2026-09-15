import { ModelRegistry, type ModelProfileProps, modelCatalog } from '@carbometre/core';
import { resolveMessages } from './i18n/resolveMessages.js';
import { ChromeStorageConversationRepository } from './storage/ChromeStorageConversationRepository.js';
import { ChromeStorageSettingsRepository } from './storage/ChromeStorageSettingsRepository.js';
import { ChromeStorageUsageHistoryRepository } from './storage/ChromeStorageUsageHistoryRepository.js';
import { AnchorFileSaver } from './ui/FileSaver.js';
import { ModalConfirmation } from './ui/ModalConfirmation.js';
import { OptionsPage } from './ui/OptionsPage.js';

async function main(): Promise<void> {
  const settings = new ChromeStorageSettingsRepository();
  const { language } = await settings.load();
  await new OptionsPage({
    doc: document,
    messages: resolveMessages(language),
    settings,
    conversations: new ChromeStorageConversationRepository(),
    usageHistory: new ChromeStorageUsageHistoryRepository(),
    models: ModelRegistry.fromCatalog(modelCatalog as unknown as ModelProfileProps[]),
    confirmation: new ModalConfirmation(document),
    files: new AnchorFileSaver(document),
    version: chrome.runtime.getManifest().version,
    methodologyUrl: chrome.runtime.getURL('methodology.html'),
  }).start();
}

main().catch((error: unknown) => {
  console.error('[Carbomètre] options page failed to start', error);
});
