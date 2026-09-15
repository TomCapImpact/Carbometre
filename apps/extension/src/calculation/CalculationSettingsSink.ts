import type { Settings } from '../storage/SettingsRepository.js';

/**
 * Whatever in the calculation pipeline reacts to the user's settings.
 * The presenter pushes settings here and knows nothing about grids or
 * registries; tests record what was pushed.
 */
export interface CalculationSettingsSink {
  apply(settings: Settings): void;
}
