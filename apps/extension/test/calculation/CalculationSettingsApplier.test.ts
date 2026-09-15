import type { UserLocation, UserLocationSink } from '@carbometre/core';
import { describe, expect, it } from 'vitest';
import { CalculationSettingsApplier } from '../../src/calculation/CalculationSettingsApplier.js';
import { DEFAULT_SETTINGS } from '../../src/storage/ChromeStorageSettingsRepository.js';

class RecordingSink implements UserLocationSink {
  received: UserLocation[] = [];
  setUserLocation(location: UserLocation): void {
    this.received.push(location);
  }
}

describe('CalculationSettingsApplier', () => {
  it('forwards the location, substituting the default while the question is unanswered', () => {
    const sink = new RecordingSink();
    const applier = new CalculationSettingsApplier(sink);
    applier.apply({ ...DEFAULT_SETTINGS, userLocation: 'fr' });
    applier.apply(DEFAULT_SETTINGS);
    expect(sink.received).toEqual(['fr', 'other']);
  });
});
