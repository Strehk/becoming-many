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
  sharedVegetationDensities,
} from "./shared-level-values";

export const level: LevelPreset = {
  // The moodboard reserves its pale stop #F6EEE0 for the background, and this
  // level ran on it. It runs on white instead: the Scent World is entered
  // from the colour-less White World, which is white, and its whole premise
  // is that colour arrives through the scent signatures alone. A warm base
  // tone is itself a colour, so it quietly spent the one thing the level had
  // to give. Every signature also reads slightly harder against it.
  backgroundColor: 0xffffff,
  viewDistance: 128,
  testUi: true,
  // The continuous world terrain stays invisible but bounds flight from below.
  invisibleGround: true,
  // Scent radiates from the plants themselves, so the level needs a plant
  // population — but its intent keeps every source object invisible, exactly
  // as the ground above is present without being rendered. The densities are
  // the shared decided ones, so the wood the scent maps is the same wood the
  // later levels show.
  invisibleVegetation: {
    instancesPerHectareByZone: sharedVegetationDensities,
  },
  // The White World air layer stays present as the neutral depth baseline.
  airParticles: sharedAirParticles,
  scentParticles: sharedScentParticles,
};
