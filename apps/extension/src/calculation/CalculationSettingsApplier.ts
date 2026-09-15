import { DEFAULT_USER_LOCATION, type GridReferenceProvider, type ModelRegistry } from '@carbometre/core';
import type { Settings } from '../storage/SettingsRepository.js';
import type { CalculationSettingsSink } from './CalculationSettingsSink.js';

/**
 * The three settings that change future estimates, routed to the objects
 * that hold them. Past estimates are never recomputed - by design, and
 * the Options page says so.
 */
export class CalculationSettingsApplier implements CalculationSettingsSink {
  constructor(
    private readonly grid: GridReferenceProvider,
    private readonly models: ModelRegistry,
  ) {}

  apply(settings: Settings): void {
    this.grid.setReference(settings.gridReference);
    this.grid.setUserLocation(settings.userLocation ?? DEFAULT_USER_LOCATION);
    this.models.setOverrides(settings.coefficientOverrides);
  }
}
