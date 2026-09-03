/**
 * Purpose: Define the independent Echolocation startup preset.
 * Context: Direct routes and benchmarks can start this world without earlier levels.
 * Responsibility: Own every authored value required by Echolocation.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-preset";

export const level: LevelPreset = {
  backgroundColor: 0xf7f7f7,
  viewDistance: 128,
  maximumGroundClearanceMeters: 50,
  testUi: true,
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
        particlesPerPlant: 70,
        emissionBottomFraction: 0.25,
        emissionTopFraction: 1,
        emissionRadiusFraction: 0.26,
        riseHeightMeters: 2.2,
      },
      deciduous: {
        color: 0x6adadd,
        particlesPerPlant: 70,
        emissionBottomFraction: 0.45,
        emissionTopFraction: 1,
        emissionRadiusFraction: 0.38,
        riseHeightMeters: 2.2,
      },
      birch: {
        color: 0xb185c2,
        particlesPerPlant: 60,
        emissionBottomFraction: 0.5,
        emissionTopFraction: 1,
        emissionRadiusFraction: 0.3,
        riseHeightMeters: 2,
      },
      bush: {
        color: 0x50be81,
        particlesPerPlant: 32,
        emissionBottomFraction: 0.1,
        emissionTopFraction: 1,
        emissionRadiusFraction: 0.72,
        riseHeightMeters: 0.7,
      },
      floweringBush: {
        color: 0xa865c7,
        particlesPerPlant: 42,
        emissionBottomFraction: 0.1,
        emissionTopFraction: 1,
        emissionRadiusFraction: 0.8,
        riseHeightMeters: 0.9,
      },
      deadWood: {
        color: 0xb2a17f,
        particlesPerPlant: 14,
        emissionBottomFraction: 0.2,
        emissionTopFraction: 0.9,
        emissionRadiusFraction: 0.2,
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
      printsPerSecond: 30,
      lifetimeSeconds: 25,
      emissionBottomFraction: 0.15,
      emissionTopFraction: 0.85,
      emissionRadiusFraction: 0.35,
      riseHeightMeters: 0.8,
      windResponseMeters: 14,
    },
    appearance: {
      sizeMeters: 0.16,
    },
    motion: {
      riseDurationSeconds: 10,
      driftAmplitudeMeters: 1.8,
      speedMultiplier: 1,
      windResponseMeters: 7,
    },
  },
  terrain: {
    opacity: 1,
  },
  vegetation: {
    colors: {
      trunkColor: 0x101010,
      leafColor: 0x171717,
      leafAccentColor: 0x494949,
      flowerColor: 0x959595,
    },
    instancesPerHectareByZone: {
      meadow: 12,
      coniferForest: 150,
      deciduousForest: 150,
      shrubSlope: 70,
    },
  },
  grassClipmap: {
    tuftsPerSquareMeter: 21.85,
    fullDensityRadiusMeters: 14,
    bladeHeightMeters: 3,
    bladeWidthMeters: 0.2,
    colors: {
      rootColor: 0x16240c,
      tipColor: 0x94c356,
    },
  },
  rocks: {
    colors: {
      darkColor: 0x171717,
      lightColor: 0x494949,
    },
    instancesPerHectareByZone: {
      meadow: 8,
      coniferForest: 10,
      deciduousForest: 10,
      shrubSlope: 60,
    },
  },
  echoDepth: {
    intensity: 1,
    nearDistanceMeters: 6,
    farDistanceMeters: 96,
    colors: {
      nearColor: 0x101010,
      nearShadeColor: 0x494949,
      midColor: 0x959595,
      farColor: 0xe2e2e2,
      hazeColor: 0xf7f7f7,
    },
  },
};
