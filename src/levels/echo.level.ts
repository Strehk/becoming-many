/**
 * Purpose: Define the independent Echolocation startup preset.
 * Context: Direct routes and benchmarks can start this world without earlier levels.
 * Responsibility: Own the presentation of Echolocation and name its modules explicitly.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import { AIR_PARTICLES } from "./authored/air-particles";
import { ECHO_DEPTH } from "./authored/echo-depth";
import { GRASS_CLIPMAP } from "./authored/grass-clipmap";
import { ROCKS } from "./authored/rocks";
import { SCENT_PARTICLES } from "./authored/scent-particles";
import { VEGETATION } from "./authored/vegetation";
import type { LevelPreset } from "./level-preset";

export const level: LevelPreset = {
  backgroundColor: 0xf7f7f7,
  viewDistance: 128,
  maximumGroundClearanceMeters: 50,
  testUi: true,
  airParticles: AIR_PARTICLES,
  scentParticles: SCENT_PARTICLES,
  echoDepth: ECHO_DEPTH,
  terrain: { opacity: 1 },
  grassClipmap: GRASS_CLIPMAP,
  vegetation: VEGETATION,
  rocks: ROCKS,
};
