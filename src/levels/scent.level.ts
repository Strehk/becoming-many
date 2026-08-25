/**
 * Purpose: Define the Scent World base-experiment preset.
 * Context: Scent (level 02) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";

export const level: LevelPreset = {
  backgroundColor: 0xf6eee0,
  viewDistance: 128,
  testUi: true,
  // The continuous world terrain stays invisible but bounds flight from below.
  invisibleGround: true,
  // The White World air layer stays present as the neutral depth baseline.
  airParticles: {
    density: {
      particlesPerChunk: 192,
    },
    appearance: {
      color: 0x202126,
      sizeMeters: 0.075,
    },
    motion: {
      horizontalAmplitudeMeters: 0.12,
      verticalAmplitudeMeters: 0.24,
      speedMultiplier: 1,
    },
  },
  scentParticles: {
    // Forest chunks spawn low, flat clouds; one 02-palette signature each.
    // The pale base tone stays reserved for the background.
    colors: [0xb8e0e1, 0x9dd2c8, 0xd1c1d7, 0xfda39d, 0xfdbb54],
    placement: {
      emittersPerChunk: 2,
      minHeightMeters: 1,
      maxHeightMeters: 2,
    },
    emission: {
      particlesPerEmitter: 192,
      cloudRadiusMeters: 3,
      cloudHeightMeters: 1,
    },
    appearance: {
      sizeMeters: 0.15,
    },
    motion: {
      riseHeightMeters: 1.5,
      riseDurationSeconds: 10,
      driftAmplitudeMeters: 0.4,
      speedMultiplier: 1,
    },
  },
};
