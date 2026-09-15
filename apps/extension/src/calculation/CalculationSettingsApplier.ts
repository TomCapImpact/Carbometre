import { DEFAULT_USER_LOCATION, type UserLocationSink } from '@carbometre/core';
import type { Settings } from '../storage/SettingsRepository.js';
import type { CalculationSettingsSink } from './CalculationSettingsSink.js';

/**
 * Routes the settings that change future estimates to the objects that
 * hold them. One today (the user's location -> grid rule); the sink
 * interface is where the next one plugs in. Past estimates are never
 * recomputed - by design, and the dashboard says so.
 */
export class CalculationSettingsApplier implements CalculationSettingsSink {
  constructor(private readonly grid: UserLocationSink) {}

  apply(settings: Settings): void {
    this.grid.setUserLocation(settings.userLocation ?? DEFAULT_USER_LOCATION);
  }
}
