export type ModelTier = 'frontier' | 'mid' | 'small';

/**
 * How much we trust the numbers behind an estimate.
 * 'measured'  - the provider publishes real figures for this model.
 * 'modelled'  - derived from published tier-level benchmarks (v1 default).
 * 'guessed'   - the model was not recognised; a tier fallback was used.
 */
export type Confidence = 'measured' | 'modelled' | 'guessed';

/**
 * Whether the serving region below is disclosed by the provider or an
 * assumption we made. No provider currently discloses this, so v1 profiles
 * are all 'assumed' - kept as a field so a future, better-informed catalog
 * entry can flip it without changing any code.
 */
export type RegionConfidence = 'stated' | 'assumed';

export interface ModelProfileProps {
  readonly id: string;
  readonly label: string;
  readonly tier: ModelTier;
  /** Key into EmissionModelRegistry, e.g. "token-based". */
  readonly emissionModelId: string;
  /** Energy per output token, in Wh. */
  readonly eTokenWh: number;
  /** Datacentre power usage effectiveness. */
  readonly pue: number;
  /** Key into the region table read by DatacenterGridProvider. */
  readonly regionId: string;
  readonly regionConfidence: RegionConfidence;
  /** Embodied (hardware manufacturing) emissions per token, in gCO2e. */
  readonly embodiedPerTokenG: number;
  /**
   * Multiplier applied to visible output tokens to approximate hidden
   * reasoning volume. Only used when thinkingVisible is false.
   */
  readonly hiddenThinkingMultiplier: number;
  /** True when the provider shows its reasoning trace (e.g. Claude extended thinking). */
  readonly thinkingVisible: boolean;
  /** Central estimate is divided/multiplied by this to get the low/high range. */
  readonly uncertaintyFactor: number;
  readonly confidence: Confidence;
  /** Citations backing the numbers above; expanded in docs/METHODOLOGY.md. */
  readonly sources: readonly string[];
}

/** Immutable value object: every coefficient needed to estimate one model's emissions. */
export class ModelProfile implements ModelProfileProps {
  readonly id: string;
  readonly label: string;
  readonly tier: ModelTier;
  readonly emissionModelId: string;
  readonly eTokenWh: number;
  readonly pue: number;
  readonly regionId: string;
  readonly regionConfidence: RegionConfidence;
  readonly embodiedPerTokenG: number;
  readonly hiddenThinkingMultiplier: number;
  readonly thinkingVisible: boolean;
  readonly uncertaintyFactor: number;
  readonly confidence: Confidence;
  readonly sources: readonly string[];

  constructor(props: ModelProfileProps) {
    this.id = props.id;
    this.label = props.label;
    this.tier = props.tier;
    this.emissionModelId = props.emissionModelId;
    this.eTokenWh = props.eTokenWh;
    this.pue = props.pue;
    this.regionId = props.regionId;
    this.regionConfidence = props.regionConfidence;
    this.embodiedPerTokenG = props.embodiedPerTokenG;
    this.hiddenThinkingMultiplier = props.hiddenThinkingMultiplier;
    this.thinkingVisible = props.thinkingVisible;
    this.uncertaintyFactor = props.uncertaintyFactor;
    this.confidence = props.confidence;
    this.sources = props.sources;
    Object.freeze(this);
  }

  /** Returns a copy with the given fields overridden - e.g. downgrading confidence on a tier fallback. */
  with(overrides: Partial<ModelProfileProps>): ModelProfile {
    return new ModelProfile({ ...this.toProps(), ...overrides });
  }

  private toProps(): ModelProfileProps {
    return {
      id: this.id,
      label: this.label,
      tier: this.tier,
      emissionModelId: this.emissionModelId,
      eTokenWh: this.eTokenWh,
      pue: this.pue,
      regionId: this.regionId,
      regionConfidence: this.regionConfidence,
      embodiedPerTokenG: this.embodiedPerTokenG,
      hiddenThinkingMultiplier: this.hiddenThinkingMultiplier,
      thinkingVisible: this.thinkingVisible,
      uncertaintyFactor: this.uncertaintyFactor,
      confidence: this.confidence,
      sources: this.sources,
    };
  }
}
