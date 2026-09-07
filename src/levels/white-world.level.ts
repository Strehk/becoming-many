/**
 * Purpose: Define the independent White World startup preset.
 * Context: Direct routes and benchmarks can start this world without later levels.
 * Responsibility: Own the presentation of White World and name its modules explicitly.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import { AIR_PARTICLES } from "./authored/air-particles";
import type { LevelPreset } from "./level-preset";

export const level: LevelPreset = {
  backgroundColor: 0xffffff,
  viewDistance: 128,
  maximumGroundClearanceMeters: 50,
  airParticles: AIR_PARTICLES,
};
