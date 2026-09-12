import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/domain/Conversation.js';
import { Estimate } from '../../src/domain/Estimate.js';
import { TokenUsage } from '../../src/domain/TokenUsage.js';

function estimateOf(gCO2e: number): Estimate {
  return Estimate.fromEnergyBreakdown({
    usage: new TokenUsage(0, 0, 0),
    energyWh: 0,
    electricityG: gCO2e,
    embodiedG: 0,
    uncertaintyFactor: 1,
    confidence: 'modelled',
  });
}

describe('Conversation', () => {
  it('starts at zero with no responses', () => {
    const conversation = new Conversation('conv-1', 'claude');
    expect(conversation.total.gCO2e).toBe(0);
    expect(conversation.responseCount).toBe(0);
  });

  it('accumulates each added estimate into the running total', () => {
    const conversation = new Conversation('conv-1', 'claude');
    conversation.addEstimate(estimateOf(0.1));
    conversation.addEstimate(estimateOf(0.2));

    expect(conversation.total.gCO2e).toBeCloseTo(0.3, 10);
    expect(conversation.responseCount).toBe(2);
  });

  it('restores a conversation from a previously stored total without double-counting', () => {
    const stored = estimateOf(1.5);
    const conversation = new Conversation('conv-1', 'claude', stored, 3);

    expect(conversation.total.gCO2e).toBeCloseTo(1.5, 10);
    expect(conversation.responseCount).toBe(3);

    conversation.addEstimate(estimateOf(0.1));
    expect(conversation.total.gCO2e).toBeCloseTo(1.6, 10);
    expect(conversation.responseCount).toBe(4);
  });

  it('resets the total and count back to zero, e.g. when the conversation changes', () => {
    const conversation = new Conversation('conv-1', 'claude');
    conversation.addEstimate(estimateOf(0.5));
    conversation.reset();

    expect(conversation.total.gCO2e).toBe(0);
    expect(conversation.responseCount).toBe(0);
  });

  it('keeps its id and providerId across resets', () => {
    const conversation = new Conversation('conv-1', 'claude');
    conversation.reset();
    expect(conversation.id).toBe('conv-1');
    expect(conversation.providerId).toBe('claude');
  });
});
