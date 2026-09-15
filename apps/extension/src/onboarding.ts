import { isUserLocation } from '@carbometre/core';
import { ChromeMessages } from './i18n/ChromeMessages.js';
import { OnboardingPage } from './ui/OnboardingPage.js';
import { ChromeStorageSettingsRepository } from './storage/ChromeStorageSettingsRepository.js';

new OnboardingPage(document, new ChromeMessages(), new ChromeStorageSettingsRepository(), isUserLocation).start();
