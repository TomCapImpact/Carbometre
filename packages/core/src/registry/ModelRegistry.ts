import { ModelProfile, type ModelProfileProps, type ModelTier } from '../domain/ModelProfile.js';
import { type CoefficientOverrides, isEditableCoefficient, isValidCoefficientValue } from './CoefficientOverrides.js';

/**
 * Used when a site adapter detects a model id the catalog doesn't know
 * (e.g. a brand-new snapshot). `providerId`/`tier` point at the closest
 * generic tier profile - by convention catalog ids are "{providerId}-{tier}",
 * e.g. "claude-mid".
 */
export interface FallbackHint {
  readonly providerId: string;
  readonly tier: ModelTier;
}

/**
 * Looks up a ModelProfile by id, falling back to a generic tier profile
 * (confidence downgraded to 'guessed') when the exact model is unknown.
 * Adding a model or a whole new provider is one `register` call - never a
 * change to this class.
 */
export class ModelRegistry {
  private readonly profiles = new Map<string, ModelProfile>();
  private overrides: CoefficientOverrides = {};

  register(profile: ModelProfile): this {
    this.profiles.set(profile.id, profile);
    return this;
  }

  resolve(modelId: string, fallback?: FallbackHint): ModelProfile {
    const exact = this.profiles.get(modelId);
    if (exact) {
      return this.applyOverrides(exact);
    }

    if (fallback) {
      const fallbackProfile = this.profiles.get(`${fallback.providerId}-${fallback.tier}`);
      if (fallbackProfile) {
        return this.applyOverrides(fallbackProfile).with({ confidence: 'guessed' });
      }
    }

    throw new Error(`ModelRegistry: unknown model "${modelId}" and no matching tier fallback was registered`);
  }

  has(modelId: string): boolean {
    return this.profiles.has(modelId);
  }

  /** Every registered profile with its catalogue (un-overridden) values, in registration order. */
  defaults(): readonly ModelProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * User-edited coefficients, applied on top of the catalogue at resolve
   * time. Replaces the previous set entirely. Entries for unknown models
   * or invalid values are ignored rather than rejected: they come from
   * storage, and one bad number must not disable the whole registry.
   */
  setOverrides(overrides: CoefficientOverrides): void {
    this.overrides = overrides;
  }

  private applyOverrides(profile: ModelProfile): ModelProfile {
    const override = this.overrides[profile.id];
    if (!override) {
      return profile;
    }
    const valid: Record<string, number> = {};
    for (const [key, value] of Object.entries(override)) {
      if (isEditableCoefficient(key) && isValidCoefficientValue(key, value)) {
        valid[key] = value;
      }
    }
    return Object.keys(valid).length > 0 ? profile.with(valid) : profile;
  }

  static fromCatalog(entries: readonly ModelProfileProps[]): ModelRegistry {
    const registry = new ModelRegistry();
    for (const entry of entries) {
      registry.register(new ModelProfile(entry));
    }
    return registry;
  }
}
