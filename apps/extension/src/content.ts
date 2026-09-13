import {
  CarbometerService,
  DatacenterGridProvider,
  EmissionModelRegistry,
  HeuristicTokenizer,
  ModelRegistry,
  type ModelProfileProps,
  modelCatalog,
  TokenBasedEmissionModel,
} from '@carbometre/core';
import { AdapterRegistry } from './adapters/AdapterRegistry.js';
import { ChatGptAdapter } from './adapters/ChatGptAdapter.js';
import { ClaudeAdapter } from './adapters/ClaudeAdapter.js';
import { MistralAdapter } from './adapters/MistralAdapter.js';
import { ChromeMessages } from './i18n/ChromeMessages.js';
import { ChromeStorageConversationRepository } from './storage/ChromeStorageConversationRepository.js';
import { ChromeStorageUsageHistoryRepository } from './storage/ChromeStorageUsageHistoryRepository.js';
import { CarbometerPresenter } from './ui/CarbometerPresenter.js';

function main(): void {
  const adapter = new AdapterRegistry([
    new ClaudeAdapter(),
    new ChatGptAdapter(),
    new MistralAdapter(),
  ]).resolveForHost(location.host);
  if (!adapter) {
    return;
  }

  const service = new CarbometerService(
    new HeuristicTokenizer(),
    ModelRegistry.fromCatalog(modelCatalog as unknown as ModelProfileProps[]),
    new EmissionModelRegistry().register('token-based', new TokenBasedEmissionModel(new DatacenterGridProvider())),
  );

  new CarbometerPresenter(
    adapter,
    service,
    new ChromeStorageConversationRepository(),
    new ChromeStorageUsageHistoryRepository(),
    new ChromeMessages(),
    chrome.runtime.getURL('methodology.html'),
  ).start();
}

main();
