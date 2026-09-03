/**
 * Purpose: Define the independent White World startup preset.
 * Context: Direct routes and benchmarks can start this world without show state.
 * Responsibility: Own every authored value required by White World.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-preset";

export const level: LevelPreset = {
  backgroundColor: 0xffffff,
  viewDistance: 128,
  maximumGroundClearanceMeters: 50,
  airParticles: {
    density: {
      particlesPerChunk: 270,
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
};
