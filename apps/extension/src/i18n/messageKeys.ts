/** Keys into _locales/{en,fr}/messages.json - one constant so a typo is a compile error, not a silent blank string. */
export const MESSAGE_KEYS = {
  badgeAriaLabel: 'badgeAriaLabel',
  badgeUnavailableAriaLabel: 'badgeUnavailableAriaLabel',
  dashboardTitle: 'dashboardTitle',
  dashboardCloseLabel: 'dashboardCloseLabel',
  dashboardConversationLabel: 'dashboardConversationLabel',
  dashboardConversationTooltip: 'dashboardConversationTooltip',
  dashboardLast30DaysLabel: 'dashboardLast30DaysLabel',
  dashboardEquivalentLabel: 'dashboardEquivalentLabel',
  dashboardEquivalentValue: 'dashboardEquivalentValue',
  dashboardMethodologyLink: 'dashboardMethodologyLink',
} as const;
