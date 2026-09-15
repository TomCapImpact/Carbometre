import type { UserLocation } from '@carbometre/core';
import { MESSAGE_KEYS } from '../i18n/messageKeys.js';
import type { Messages } from '../i18n/Messages.js';
import type { SettingsRepository } from '../storage/SettingsRepository.js';

/**
 * Drives onboarding.html: fills the [data-i18n] texts, and on a click of a
 * [data-location] button saves the answer and shows the confirmation.
 * The markup itself is static HTML (MV3 forbids inline scripts, so the
 * behaviour has to be here) - this class is the only place that knows
 * which attributes that markup uses.
 */
export class OnboardingPage {
  constructor(
    private readonly doc: Document,
    private readonly messages: Messages,
    private readonly settings: SettingsRepository,
    private readonly isLocation: (value: unknown) => value is UserLocation,
  ) {}

  start(): void {
    for (const el of this.doc.querySelectorAll<HTMLElement>('[data-i18n]')) {
      const key = el.dataset.i18n;
      if (key) {
        el.textContent = this.messages.get(key);
      }
    }
    this.doc.title = this.messages.get(MESSAGE_KEYS.onboardingTitle);

    for (const button of this.doc.querySelectorAll<HTMLButtonElement>('button[data-location]')) {
      button.addEventListener('click', () => {
        const location = button.dataset.location;
        if (this.isLocation(location)) {
          void this.answer(location);
        }
      });
    }
  }

  private async answer(userLocation: UserLocation): Promise<void> {
    const current = await this.settings.load();
    await this.settings.save({ ...current, userLocation });

    const question = this.doc.querySelector<HTMLElement>('[data-step="question"]');
    const done = this.doc.querySelector<HTMLElement>('[data-step="done"]');
    if (question) {
      question.hidden = true;
    }
    if (done) {
      done.hidden = false;
      done.focus();
    }
  }
}
