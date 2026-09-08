/**
 * Purpose: Supply concrete modules used only by standalone diagnostic presets.
 * Context: The standalone-level entry owns the Zone Visualizer dependency.
 * Responsibility: Load only the implementations requested by one standalone preset.
 * Boundary: Show and Conductor entries never import this file.
 */

import type { StandaloneLevelModules } from "../levels/level-composition";
import type { WorldComposition } from "../levels/level-preset";

export async function loadStandaloneLevelModules(
  level: WorldComposition,
): Promise<StandaloneLevelModules> {
  const zones =
    level.terrain?.presentation === "zones"
      ? await import("../modules/zone-visualizer/zone-visualizer")
      : undefined;
  return {
    createZonePresentation: zones?.createZoneVisualizer,
  };
}
