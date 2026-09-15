import { AVERAGE_CAR_GCO2E_PER_KM } from './CarEquivalence.js';
import { type Equivalence, type EquivalenceId, FixedFactorEquivalence } from './Equivalence.js';

/**
 * Short-haul flight, per passenger-kilometre, contrails included -
 * ADEME Base Empreinte, "Avion passagers, court-courrier (< 1000 km)".
 * Short-haul is the right reference for a "how far would that fly me"
 * comparison at the scale of grams: it is the per-km worst case.
 */
export const PLANE_GCO2E_PER_PASSENGER_KM = 258;

/**
 * Builds the equivalence for an id. Every factor is a physical constant of
 * the vehicle, independent of where the user lives - see Equivalence.ts for
 * why that independence is a requirement.
 */
export class EquivalenceCatalog {
  resolve(id: EquivalenceId): Equivalence {
    switch (id) {
      case 'car-km':
        return new FixedFactorEquivalence(id, AVERAGE_CAR_GCO2E_PER_KM);
      case 'plane-km':
        return new FixedFactorEquivalence(id, PLANE_GCO2E_PER_PASSENGER_KM);
    }
  }
}
