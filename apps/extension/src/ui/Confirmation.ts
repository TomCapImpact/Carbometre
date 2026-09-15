export interface ConfirmationRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

/**
 * "Are you sure?" as a dependency, so the presenter can ask without knowing
 * how the question is rendered - and tests can answer without a DOM.
 */
export interface Confirmation {
  ask(request: ConfirmationRequest): Promise<boolean>;
}
