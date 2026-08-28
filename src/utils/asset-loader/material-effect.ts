/**
 * Purpose: Define the shared contract for composable unlit material effects.
 * Context: One sense effect may decorate materials owned by several modules.
 * Responsibility: Type the effect surfaces and apply effect lists to part materials.
 * Boundary: Concrete effects, material creation, and module lifecycle stay elsewhere.
 */

import type { Material, MeshBasicMaterial } from "three";

/**
 * One composable decoration for an unlit material; application is one-way.
 *
 * The parameter is the `Material` base type because a consumer may own a
 * hand-written `ShaderMaterial` rather than a `MeshBasicMaterial`: an effect
 * needs only `onBeforeCompile` and `customProgramCacheKey`, which every
 * material carries. Consumers still pass their own concrete material.
 */
export interface UnlitMaterialEffect {
  readonly applyTo: (material: Material) => void;
}

/**
 * The same decoration applied to one animated actor, which additionally
 * receives the real body height of the species wearing the material.
 *
 * A sense that models a body needs to know how big that body is: a heat
 * distribution authored in metres fits a stag and swallows a rat, while the
 * same distribution in fractions of body height fits both. Effects that do not
 * care simply ignore the extra argument — an `UnlitMaterialEffect` satisfies
 * this contract unchanged.
 */
export interface ActorMaterialEffect {
  readonly applyTo: (material: Material, bodyHeightMeters: number) => void;
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

/** Apply every effect to one actor part, passing the species' body height. */
export function applyActorMaterialEffects(
  effects: readonly ActorMaterialEffect[],
  material: MeshBasicMaterial | MeshBasicMaterial[],
  bodyHeightMeters: number,
): void {
  const materials = Array.isArray(material) ? material : [material];
  for (const effect of effects) {
    for (const target of materials) effect.applyTo(target, bodyHeightMeters);
  }
}
