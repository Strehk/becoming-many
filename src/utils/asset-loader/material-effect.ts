/**
 * Purpose: Define the shared contracts for composable material effects.
 * Context: One sense effect may decorate materials owned by several modules.
 * Responsibility: Type distinct effect surfaces and apply unlit effects to part materials.
 * Boundary: Concrete effects, material creation, and module lifecycle stay elsewhere.
 */

import type { MeshBasicMaterial, ShaderMaterial } from "three";

/**
 * A material a sense effect may decorate. Three.js built-in passes and a
 * module's own shader both qualify: what an effect needs is the chunk
 * anchors it injects at, not a particular material class.
 */
export type SensedMaterial = MeshBasicMaterial | ShaderMaterial;

/** One composable decoration for an unlit material; application is one-way. */
export interface UnlitMaterialEffect {
  readonly applyTo: (material: SensedMaterial) => void;
}

/** A terrain material decoration with optional per-frame and vertex samplers. */
export interface TerrainMaterialEffect {
  readonly applyTo: (material: MeshBasicMaterial) => void;
  readonly update?: (deltaSeconds: number) => void;

  /** Declaring a sampler makes Terrain stream a per-vertex warmth attribute. */
  readonly warmthAt?: (
    worldX: number,
    worldZ: number,
    groundYMeters: number,
  ) => number;

  /**
   * Declaring a sampler makes Terrain stream a per-vertex ground-cover
   * attribute: how much of this surface something else already grows on. An
   * effect that treats covered and bare ground differently reads it instead of
   * deriving zones in GLSL, which would duplicate the zone thresholds.
   */
  readonly coverAt?: (worldX: number, worldZ: number) => number;
}

/** Apply every effect to one part's single or multi-slot material. */
export function applyMaterialEffects(
  effects: readonly UnlitMaterialEffect[],
  material: SensedMaterial | SensedMaterial[],
): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const effect of effects) {
    for (const target of materials) effect.applyTo(target);
  }
}
