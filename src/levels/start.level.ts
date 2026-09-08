/** Standalone steering practice; Run supplies input and World owns its lifetime. */
import type { LevelPreset } from "./level-preset";

export const level: LevelPreset = {
  backgroundColor: 0xffffff,
  viewDistance: 128,
  maximumGroundClearanceMeters: 50,
  start: { guideDistanceMeters: 4 },
  airParticles: {
    density: { particlesPerChunk: 270 },
    appearance: { color: 0x202126, sizeMeters: 0.075 },
    motion: {
      horizontalAmplitudeMeters: 0.12,
      verticalAmplitudeMeters: 0.24,
      speedMultiplier: 1,
    },
  },
};
