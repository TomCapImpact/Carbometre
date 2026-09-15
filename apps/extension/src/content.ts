import {
  CarbometerService,
  DatacenterGridProvider,
  EmissionModelRegistry,
  EquivalenceCatalog,
  HeuristicTokenizer,
  ModelRegistry,
  type ModelProfileProps,
  modelCatalog,
  TokenBasedEmissionModel,
  UserLocationGridProvider,
} from '@carbometre/core';
import { AdapterRegistry } from './adapters/AdapterRegistry.js';
import { ChatGptAdapter } from './adapters/ChatGptAdapter.js';
import { ClaudeAdapter } from './adapters/ClaudeAdapter.js';
import { MistralAdapter } from './adapters/MistralAdapter.js';
import { ChromeMessages } from './i18n/ChromeMessages.js';
import { ChromeStorageConversationRepository } from './storage/ChromeStorageConversationRepository.js';
import { ChromeStorageSettingsRepository } from './storage/ChromeStorageSettingsRepository.js';
import { ChromeStorageUsageHistoryRepository } from './storage/ChromeStorageUsageHistoryRepository.js';
import { CarbometerPresenter } from './ui/CarbometerPresenter.js';
import { ModalConfirmation } from './ui/ModalConfirmation.js';

function main(): void {
  const adapter = new AdapterRegistry([
    new ClaudeAdapter(),
    new ChatGptAdapter(),
    new MistralAdapter(),
  ]).resolveForHost(location.host);
  if (!adapter) {
    return;
  }

  // The user's location wraps the datacentre grid: French mix for
  // European-hosted models when the user is in France, datacentre grid
  // otherwise. The presenter updates it as the setting loads and changes.
  const gridProvider = new UserLocationGridProvider(new DatacenterGridProvider());
  const service = new CarbometerService(
    new HeuristicTokenizer(),
    ModelRegistry.fromCatalog(modelCatalog as unknown as ModelProfileProps[]),
    new EmissionModelRegistry().register('token-based', new TokenBasedEmissionModel(gridProvider)),
  );

  new CarbometerPresenter({
    adapter,
    service,
    conversations: new ChromeStorageConversationRepository(),
    usageHistory: new ChromeStorageUsageHistoryRepository(),
    settings: new ChromeStorageSettingsRepository(),
    locationSink: gridProvider,
    equivalences: new EquivalenceCatalog(),
    confirmation: new ModalConfirmation(document),
    messages: new ChromeMessages(),
    methodologyUrl: chrome.runtime.getURL('methodology.html'),
  }).start();
}

main();
