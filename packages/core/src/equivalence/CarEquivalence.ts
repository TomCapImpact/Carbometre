/**
 * Average car emissions per kilometre driven, in gCO2e/km - used only to
 * turn a total into something intuitively comparable. Not a per-model
 * coefficient, so it lives here rather than in a ModelProfile.
 */
export const AVERAGE_CAR_GCO2E_PER_KM = 125;

/** Kilometres an average car would need to drive to emit the same amount. */
export function gCO2eToCarKm(gCO2e: number): number {
  return gCO2e / AVERAGE_CAR_GCO2E_PER_KM;
}
