/** Spatial practice; the same recipe supplies standalone and Show training. */
import type { LevelPreset } from "./level-preset";

export const level: LevelPreset = {
  backgroundColor: 0xffffff,
  viewDistance: 128,
  desktopFieldOfViewDegrees: 80,
  maximumGroundClearanceMeters: 50,
  start: {
    arrivalSeconds: 2.5,
    formationSeconds: 2,
    dissolutionSeconds: 3,
    guideDistanceMeters: 4,
    goals: [
      { direction: "right", offsetMeters: [12, 0, -32], radiusMeters: 3.5 },
      { direction: "left", offsetMeters: [-12, 0, -92], radiusMeters: 3.5 },
      { direction: "up", offsetMeters: [-12, 16, -152], radiusMeters: 3.5 },
      { direction: "down", offsetMeters: [0, 0, -212], radiusMeters: 3.5 },
    ],
    particles: {
      count: 1400,
      sizeMeters: 0.065,
      color: 0x425563,
      cloudRadiusMeters: 5,
      cloudDepthMeters: 5,
      driftAmplitudeMeters: 0.18,
      driftSpeed: 0.65,
      sparkle: 0.08,
      glow: 0.12,
      wakeRadiusMeters: 8,
      wakeDurationSeconds: 2.4,
      wakeDistanceMeters: 2.5,
    },
  },
  airParticles: {
    density: { particlesPerChunk: 80 },
    appearance: { color: 0x202126, sizeMeters: 0.075 },
    motion: {
      horizontalAmplitudeMeters: 0.12,
      verticalAmplitudeMeters: 0.24,
      speedMultiplier: 1,
    },
  },
};
