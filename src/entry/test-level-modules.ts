/**
 * Purpose: Supply concrete modules used only by standalone diagnostic presets.
 * Context: The Test entry owns the Zone Visualizer dependency.
 * Responsibility: Load only the implementations requested by one Test preset.
 * Boundary: Show and Conductor entries never import this file.
 */

import type { TestLevelModules } from "../levels/level-composition";
import type { WorldComposition } from "../levels/level-preset";

export async function loadTestLevelModules(
  level: WorldComposition,
): Promise<TestLevelModules> {
  const zones =
    level.terrain?.presentation === "zones"
      ? await import("../modules/zone-visualizer/zone-visualizer")
      : undefined;
  return {
    createZonePresentation: zones?.createZoneVisualizer,
  };
}
