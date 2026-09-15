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
import { OPEN_OPTIONS_MESSAGE } from './background/messages.js';
import { CalculationSettingsApplier } from './calculation/CalculationSettingsApplier.js';
import { resolveMessages } from './i18n/resolveMessages.js';
import { ChromeStorageConversationRepository } from './storage/ChromeStorageConversationRepository.js';
import { ChromeStorageSettingsRepository } from './storage/ChromeStorageSettingsRepository.js';
import { ChromeStorageUsageHistoryRepository } from './storage/ChromeStorageUsageHistoryRepository.js';
import { CarbometerPresenter } from './ui/CarbometerPresenter.js';
import { ModalConfirmation } from './ui/ModalConfirmation.js';

async function main(): Promise<void> {
  const adapter = new AdapterRegistry([
    new ClaudeAdapter(),
    new ChatGptAdapter(),
    new MistralAdapter(),
  ]).resolveForHost(location.host);
  if (!adapter) {
    return;
  }

  // Settings are read once up front only for the language: the views bake
  // their strings in at construction, so a language override applies on
  // the next page load. Everything else the presenter applies live.
  const settingsRepository = new ChromeStorageSettingsRepository();
  const settings = await settingsRepository.load();

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
    settings: settingsRepository,
    calculation: new CalculationSettingsApplier(gridProvider),
    equivalences: new EquivalenceCatalog(),
    confirmation: new ModalConfirmation(document),
    messages: resolveMessages(settings.language),
    methodologyUrl: chrome.runtime.getURL('methodology.html'),
    openOptions: () => void chrome.runtime.sendMessage(OPEN_OPTIONS_MESSAGE),
  }).start();
}

main().catch((error: unknown) => {
  console.error('[Carbomètre] failed to start', error);
});
