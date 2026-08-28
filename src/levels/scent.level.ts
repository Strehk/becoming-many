/**
 * Purpose: Define the Scent World base-experiment preset.
 * Context: Scent (level 02) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import {
  sharedAirParticles,
  sharedScentParticles,
} from "./shared-level-values";

export const level: LevelPreset = {
  backgroundColor: 0xf6eee0,
  viewDistance: 128,
  testUi: true,
  // The continuous world terrain stays invisible but bounds flight from below.
  invisibleGround: true,
  // The White World air layer stays present as the neutral depth baseline.
  airParticles: sharedAirParticles,
  scentParticles: sharedScentParticles,
};
