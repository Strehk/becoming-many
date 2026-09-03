/**
 * Purpose: Supply concrete modules used only by standalone diagnostic presets.
 * Context: The Test entry owns legacy Grass and Zone Visualizer dependencies.
 * Responsibility: Load only the implementations requested by one Test preset.
 * Boundary: Show and Conductor entries never import this file.
 */

import type { TestLevelModules } from "../levels/level-composition";
import type { WorldComposition } from "../levels/level-preset";

export async function loadTestLevelModules(
  level: WorldComposition,
): Promise<TestLevelModules> {
  const [grass, zones] = await Promise.all([
    level.grass ? import("../modules/grass/grass") : undefined,
    level.terrain?.presentation === "zones"
      ? import("../modules/zone-visualizer/zone-visualizer")
      : undefined,
  ]);
  return {
    createLegacyGrass: grass?.createGrassModule,
    createZonePresentation: zones?.createZoneVisualizer,
  };
}
