import type { EmissionModel } from './EmissionModel.js';

/**
 * Maps a ModelProfile's `emissionModelId` to the EmissionModel instance that
 * should handle it. Registering a new methodology never requires editing an
 * existing EmissionModel.
 */
export class EmissionModelRegistry {
  private readonly models = new Map<string, EmissionModel>();

  register(id: string, model: EmissionModel): this {
    this.models.set(id, model);
    return this;
  }

  resolve(id: string): EmissionModel {
    const model = this.models.get(id);
    if (!model) {
      throw new Error(`EmissionModelRegistry: no EmissionModel registered for id "${id}"`);
    }
    return model;
  }

  has(id: string): boolean {
    return this.models.has(id);
  }
}
