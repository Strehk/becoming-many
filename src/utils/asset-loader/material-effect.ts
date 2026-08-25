/**
 * Purpose: Define the shared contract for composable unlit material effects.
 * Context: One sense effect may decorate materials owned by several modules.
 * Responsibility: Type the effect surface and apply effect lists to part materials.
 * Boundary: Concrete effects, material creation, and module lifecycle stay elsewhere.
 */

import type { MeshBasicMaterial } from "three";

/** One composable decoration for an unlit material; application is one-way. */
export interface UnlitMaterialEffect {
  readonly applyTo: (material: MeshBasicMaterial) => void;
}

/** Apply every effect to one part's single or multi-slot material. */
export function applyMaterialEffects(
  effects: readonly UnlitMaterialEffect[],
  material: MeshBasicMaterial | MeshBasicMaterial[],
): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const effect of effects) {
    for (const target of materials) effect.applyTo(target);
  }
}
