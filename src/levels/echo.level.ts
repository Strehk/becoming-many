/**
 * Purpose: Define the Echolocation level preset ("Bat — Depth", level 03).
 * Context: Echolocation (level 03) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import {
  sharedAirParticles,
  sharedEchoDepth,
  sharedEchoHazeColor,
  sharedEchoRocks,
  sharedEchoVegetation,
  sharedScentParticles,
} from "./shared-level-values";

export const level: LevelPreset = {
  backgroundColor: sharedEchoHazeColor,
  viewDistance: 128,
  testUi: true,
  terrain: {
    opacity: 1,
  },
  vegetation: sharedEchoVegetation,
  rocks: sharedEchoRocks,
  // Senses layer, never swap: the White World air layer and the Scent World
  // layer stay present while the depth response becomes dominant.
  airParticles: sharedAirParticles,
  scentParticles: sharedScentParticles,
  echoDepth: sharedEchoDepth,
};
