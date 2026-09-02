/**
 * Purpose: Define the initial White World presentation preset.
 * Context: White World is the first narrative world state.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import { sharedAirParticles } from "./shared-level-values";

export const level: LevelPreset = {
  backgroundColor: 0xffffff,
  viewDistance: 128,
  maximumGroundClearanceMeters: 50,
  airParticles: sharedAirParticles,
};
