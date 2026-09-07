/**
 * Purpose: Define the independent Scent startup preset.
 * Context: Direct routes and benchmarks can start this world without earlier levels.
 * Responsibility: Own the presentation of Scent, its invisible source world, and its modules.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import { AIR_PARTICLES } from "./authored/air-particles";
import { SCENT_PARTICLES } from "./authored/scent-particles";
import { VEGETATION_PLACEMENT } from "./authored/vegetation";
import type { LevelPreset } from "./level-preset";

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
  airParticles: AIR_PARTICLES,
  scentParticles: SCENT_PARTICLES,
};
