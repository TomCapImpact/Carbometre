/**
 * Which electricity the estimate is priced on. 'datacenter' is the only
 * physically honest choice and the default; 'french-mix' charges every
 * model at the French grid regardless of where it runs - a comparison
 * mode the Options page offers under the label "Référence électrique :
 * localisation réelle des serveurs (défaut) / mix français".
 */
export type GridReference = 'datacenter' | 'french-mix';

export const GRID_REFERENCES: readonly GridReference[] = ['datacenter', 'french-mix'];

export const DEFAULT_GRID_REFERENCE: GridReference = 'datacenter';

export function isGridReference(value: unknown): value is GridReference {
  return typeof value === 'string' && (GRID_REFERENCES as readonly string[]).includes(value);
}
