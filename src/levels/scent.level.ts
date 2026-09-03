/**
 * Purpose: Define the independent Scent startup preset.
 * Context: Direct routes and benchmarks can start this world without earlier levels.
 * Responsibility: Own the presentation of Scent, its invisible source world, and the layers it carries.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import { VEGETATION_PLACEMENT } from "./authored/vegetation";
import type { LevelPreset } from "./level-preset";
import { SCENT_LAYER, WHITE_WORLD_LAYER } from "./sense-layers";

export const level: LevelPreset = {
  backgroundColor: 0xffffff,
  viewDistance: 128,
  maximumGroundClearanceMeters: 50,
  testUi: true,
  // Scent alone stands on an unseen world: the ground and plants are placed
  // but not drawn, so trails rise where Echo will later show the plants.
  invisibleGround: true,
  invisibleVegetation: {
    instancesPerHectareByZone: VEGETATION_PLACEMENT,
  },
  ...WHITE_WORLD_LAYER,
  ...SCENT_LAYER,
};
