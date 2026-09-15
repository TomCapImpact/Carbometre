import { isUserLocation } from '@carbometre/core';
import { resolveMessages } from './i18n/resolveMessages.js';
import { OnboardingPage } from './ui/OnboardingPage.js';
import { ChromeStorageSettingsRepository } from './storage/ChromeStorageSettingsRepository.js';

async function main(): Promise<void> {
  const settings = new ChromeStorageSettingsRepository();
  const { language } = await settings.load();
  new OnboardingPage(document, resolveMessages(language), settings, isUserLocation).start();
}

main().catch((error: unknown) => {
  console.error('[Carbomètre] onboarding failed to start', error);
});
