import { Estimate } from './Estimate.js';

/**
 * Entity: a single chat conversation on one provider, identified by `id`.
 * Unlike Estimate, this is mutable - it is the running accumulator that
 * ConversationRepository loads and persists.
 */
export class Conversation {
  private accumulated: Estimate;
  private count: number;

  constructor(
    readonly id: string,
    readonly providerId: string,
    initialTotal: Estimate = Estimate.zero(),
    initialResponseCount = 0,
  ) {
    this.accumulated = initialTotal;
    this.count = initialResponseCount;
  }

  get total(): Estimate {
    return this.accumulated;
  }

  get responseCount(): number {
    return this.count;
  }

  /** Adds one more response's estimate to the running total. */
  addEstimate(estimate: Estimate): void {
    this.accumulated = this.accumulated.plus(estimate);
    this.count += 1;
  }

  /** Returns the conversation to a freshly-started state, e.g. when the user starts a new chat. */
  reset(): void {
    this.accumulated = Estimate.zero();
    this.count = 0;
  }
}
