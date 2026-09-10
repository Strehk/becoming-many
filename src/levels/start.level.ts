/** A white free-flight environment containing only airborne particles. */
import type { LevelPreset } from "./level-preset";

export const level: LevelPreset = {
  flightSpeedMetersPerSecond: 2,
  backgroundColor: 0xffffff,
  viewDistance: 128,
  desktopFieldOfViewDegrees: 80,
  maximumGroundClearanceMeters: 50,
  airParticles: {
    streaming: { chunkLevel: 0, viewDistanceMeters: 16, fadeStartMeters: 12 },
    density: { particlesPerChunk: 384 },
    appearance: { color: 0x899096, sizeMeters: 0.045, shape: "circle" },
    motion: {
      horizontalAmplitudeMeters: 0.12,
      verticalAmplitudeMeters: 0.24,
      speedMultiplier: 0.45,
    },
  },
};
