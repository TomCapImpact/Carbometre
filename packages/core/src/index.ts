export { CarbometerService, type EstimateInput } from './CarbometerService.js';

export { Estimate, type EnergyBreakdown, type EstimateFields } from './domain/Estimate.js';
export {
  ModelProfile,
  type Confidence,
  type ModelProfileProps,
  type ModelTier,
  type RegionConfidence,
} from './domain/ModelProfile.js';
export { TokenUsage } from './domain/TokenUsage.js';
export { Conversation } from './domain/Conversation.js';
export {
  DEFAULT_USER_LOCATION,
  isUserLocation,
  USER_LOCATIONS,
  type UserLocation,
  type UserLocationSink,
} from './domain/UserLocation.js';

export { type SupportedLanguage, type Tokenizer } from './tokenizer/Tokenizer.js';
export { CHARS_PER_TOKEN, HeuristicTokenizer } from './tokenizer/HeuristicTokenizer.js';

export type { EmissionModel } from './emissions/EmissionModel.js';
export { DEFAULT_INPUT_WEIGHT, TokenBasedEmissionModel } from './emissions/TokenBasedEmissionModel.js';
export { EmissionModelRegistry } from './emissions/EmissionModelRegistry.js';

export type { GridIntensityProvider } from './grid/GridIntensityProvider.js';
export { DatacenterGridProvider, type RegionEntry, type RegionTable } from './grid/DatacenterGridProvider.js';
export { FrenchGridProvider, FRENCH_GRID_INTENSITY } from './grid/FrenchGridProvider.js';
export { isEuropeanRegion, UserLocationGridProvider } from './grid/UserLocationGridProvider.js';

export { ModelRegistry, type FallbackHint } from './registry/ModelRegistry.js';
export { default as modelCatalog } from './registry/models.json' with { type: 'json' };

export { AVERAGE_CAR_GCO2E_PER_KM, gCO2eToCarKm } from './equivalence/CarEquivalence.js';
export {
  DEFAULT_EQUIVALENCE_ID,
  EQUIVALENCE_IDS,
  type Equivalence,
  type EquivalenceId,
  FixedFactorEquivalence,
  isEquivalenceId,
} from './equivalence/Equivalence.js';
export { EquivalenceCatalog, PLANE_GCO2E_PER_PASSENGER_KM } from './equivalence/EquivalenceCatalog.js';
