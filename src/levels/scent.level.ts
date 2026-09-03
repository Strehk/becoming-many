/**
 * Purpose: Define the independent Scent World startup preset.
 * Context: Direct routes and benchmarks can start this world without show state.
 * Responsibility: Own every authored value required by Scent World.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-preset";

export const level: LevelPreset = {
  backgroundColor: 0xffffff,
  viewDistance: 128,
  maximumGroundClearanceMeters: 50,
  testUi: true,
  invisibleGround: true,
  invisibleVegetation: {
    instancesPerHectareByZone: {
      meadow: 12,
      coniferForest: 150,
      deciduousForest: 150,
      shrubSlope: 70,
    },
  },
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
  scentParticles: {
    plants: {
      conifer: {
        color: 0x55d1ba,
        particlesPerPlant: 84,
        emissionBottomFraction: 0.25,
        emissionTopFraction: 1,
        emissionRadiusFraction: 0.34,
        riseHeightMeters: 2.2,
      },
      deciduous: {
        color: 0x6adadd,
        particlesPerPlant: 84,
        emissionBottomFraction: 0.45,
        emissionTopFraction: 1,
        emissionRadiusFraction: 0.46,
        riseHeightMeters: 2.2,
      },
      birch: {
        color: 0xb185c2,
        particlesPerPlant: 72,
        emissionBottomFraction: 0.5,
        emissionTopFraction: 1,
        emissionRadiusFraction: 0.38,
        riseHeightMeters: 2,
      },
      bush: {
        color: 0x50be81,
        particlesPerPlant: 40,
        emissionBottomFraction: 0.1,
        emissionTopFraction: 1,
        emissionRadiusFraction: 0.85,
        riseHeightMeters: 0.7,
      },
      floweringBush: {
        color: 0xa865c7,
        particlesPerPlant: 52,
        emissionBottomFraction: 0.1,
        emissionTopFraction: 1,
        emissionRadiusFraction: 0.95,
        riseHeightMeters: 0.9,
      },
      deadWood: {
        color: 0xb2a17f,
        particlesPerPlant: 18,
        emissionBottomFraction: 0.2,
        emissionTopFraction: 0.9,
        emissionRadiusFraction: 0.28,
        riseHeightMeters: 0.5,
      },
    },
    animals: {
      signatures: {
        deer: {
          color: 0xfdbb54,
        },
        stag: {
          color: 0xef8f3c,
        },
        fox: {
          color: 0xfda39d,
        },
        rat: {
          color: 0xd8919c,
        },
      },
      printsPerSecond: 20,
      lifetimeSeconds: 25,
      emissionBottomFraction: 0.15,
      emissionTopFraction: 0.85,
      emissionRadiusFraction: 0.35,
      riseHeightMeters: 0.8,
      windResponseMeters: 4,
    },
    appearance: {
      sizeMeters: 0.16,
    },
    motion: {
      riseDurationSeconds: 10,
      driftAmplitudeMeters: 1.3,
      speedMultiplier: 1,
      windResponseMeters: 7,
    },
  },
};
