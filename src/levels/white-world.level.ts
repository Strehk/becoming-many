/**
 * Purpose: Define the independent White World startup preset.
 * Context: Direct routes and benchmarks can start this world without later levels.
 * Responsibility: Own the presentation of White World and name the layers it carries.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-preset";
import { WHITE_WORLD_LAYER } from "./sense-layers";

export const level: LevelPreset = {
  backgroundColor: 0xffffff,
  viewDistance: 128,
  maximumGroundClearanceMeters: 50,
  ...WHITE_WORLD_LAYER,
};
