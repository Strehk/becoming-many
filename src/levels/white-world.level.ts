/**
 * Purpose: Define the initial White World presentation preset.
 * Context: White World is the first narrative world state.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";

export const level: LevelPreset = {
  backgroundColor: 0xffffff,
  viewDistance: 128,
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
};
