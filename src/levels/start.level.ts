/** A white free-flight environment with airborne particles and directional light. */
import type { LevelPreset } from "./level-preset";

export const level: LevelPreset = {
  flightSpeedMetersPerSecond: 2,
  backgroundColor: 0xffffff,
  viewDistance: 128,
  desktopFieldOfViewDegrees: 80,
  maximumGroundClearanceMeters: 50,
  flightGuidance: {
    color: 0xf0bc50,
    opacity: 0.6,
    lengthMeters: 14,
    behindMeters: 4,
    widthMeters: 3,
    belowFlightMeters: 0.5,
  },
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
