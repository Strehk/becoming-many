/**
 * Purpose: Define the independent Motion Perception startup preset.
 * Context: Direct routes and benchmarks can start this world without earlier levels.
 * Responsibility: Own the presentation of Motion Perception and name the layers it carries.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-preset";
import {
  ECHO_LAYER,
  MOTION_LAYER,
  SCENT_LAYER,
  WHITE_WORLD_LAYER,
} from "./sense-layers";

export const level: LevelPreset = {
  backgroundColor: 0xf7f7f7,
  viewDistance: 128,
  maximumGroundClearanceMeters: 50,
  testUi: true,
  ...WHITE_WORLD_LAYER,
  ...SCENT_LAYER,
  ...ECHO_LAYER,
  ...MOTION_LAYER,
};
