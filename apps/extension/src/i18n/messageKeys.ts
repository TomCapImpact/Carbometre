import type { EquivalenceId } from '@carbometre/core';

/** Keys into _locales/{en,fr}/messages.json - one constant so a typo is a compile error, not a silent blank string. */
export const MESSAGE_KEYS = {
  badgeAriaLabel: 'badgeAriaLabel',
  badgeUnavailableAriaLabel: 'badgeUnavailableAriaLabel',
  dashboardTitle: 'dashboardTitle',
  dashboardCloseLabel: 'dashboardCloseLabel',
  dashboardConversationLabel: 'dashboardConversationLabel',
  dashboardConversationTooltip: 'dashboardConversationTooltip',
  dashboardSinceLabel: 'dashboardSinceLabel',
  dashboardResetLabel: 'dashboardResetLabel',
  dashboardResetConfirmLabel: 'dashboardResetConfirmLabel',
  dashboardResetAriaLabel: 'dashboardResetAriaLabel',
  dashboardDetailsLabel: 'dashboardDetailsLabel',
  dashboardDetailsHideLabel: 'dashboardDetailsHideLabel',
  dashboardSinceInstallLabel: 'dashboardSinceInstallLabel',
  dashboardMonthToDateLabel: 'dashboardMonthToDateLabel',
  dashboardEquivalentLabel: 'dashboardEquivalentLabel',
  equivalenceSelectLabel: 'equivalenceSelectLabel',
  dashboardLocationLabel: 'dashboardLocationLabel',
  locationSelectLabel: 'locationSelectLabel',
  locationOptionFr: 'locationOptionFr',
  locationOptionOther: 'locationOptionOther',
  locationUnset: 'locationUnset',
  locationChangeTitle: 'locationChangeTitle',
  locationChangeWarning: 'locationChangeWarning',
  locationChangeConfirmLabel: 'locationChangeConfirmLabel',
  locationChangeCancelLabel: 'locationChangeCancelLabel',
  dashboardMethodologyLink: 'dashboardMethodologyLink',
  onboardingTitle: 'onboardingTitle',
  onboardingQuestion: 'onboardingQuestion',
  onboardingExplanation: 'onboardingExplanation',
  onboardingDone: 'onboardingDone',
} as const;

/** Per-equivalence strings: the picker's option label, and the "$AMOUNT$ km by car" sentence. */
export const EQUIVALENCE_MESSAGE_KEYS: Readonly<Record<EquivalenceId, { option: string; value: string }>> = {
  'car-km': { option: 'equivalenceOptionCarKm', value: 'equivalentValueCarKm' },
  'plane-km': { option: 'equivalenceOptionPlaneKm', value: 'equivalentValuePlaneKm' },
};
