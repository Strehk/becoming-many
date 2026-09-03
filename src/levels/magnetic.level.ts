/**
 * Purpose: Define the independent Magnetic Perception startup preset.
 * Context: Direct routes and benchmarks can start this world without earlier levels.
 * Responsibility: Own every authored value required by Magnetic Perception.
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
  motion: {
    intensity: 1,
    swarms: {
      swarmCount: 12,
      fliesPerSwarm: 60,
      flightSpeedMultiplier: 1,
    },
    appearance: {
      flyColor: 0x212133,
      flySizeMeters: 0.07,
      trailColor: 0x312758,
      trailSizeMeters: 0.055,
      trailOpacity: 1,
    },
    trail: {
      lifetimeFrames: 14,
      expansionDistanceMeters: 0.22,
      motionGain: 26,
      fadePower: 1.6,
      density: 1,
    },
    birds: {
      flockCount: 3,
      birdsPerFlock: 12,
      flightSpeedMetersPerSecond: 8,
      flightHeightMeters: 14,
      appearance: {
        trailColor: 0x10bedb,
        trailSizeMeters: 0.18,
        trailOpacity: 1,
      },
    },
  },
  animals: {
    colors: {
      furColor: 0x171717,
      lightFurColor: 0x494949,
      darkFurColor: 0x101010,
      featureColor: 0x101010,
    },
  },
  thermal: {
    intensity: 1,
    radiusMeters: 35,
    edgeFeatherMeters: 12,
    carriedColorBlend: 0.42,
    colors: {
      coldestColor: 0x0e0628,
      coldColor: 0x072b7d,
      coolColor: 0x1c6c8b,
      warmColor: 0xd5198a,
      hotColor: 0xfb5f16,
      hottestColor: 0xfcce43,
    },
    surfaces: {
      vegetationWarmth: 0.84,
      vegetationWarmthSpread: 0.05,
      vegetationHeightWarmthPerMeter: -0.06,
      vegetationAxisWarmthPerMeter: -0.11,
      vegetationTextureWarmth: 0.26,
      vegetationContrast: 0.34,
      rockWarmth: 0.2,
      rockWarmthSpread: 0.18,
      rockHeightWarmthPerMeter: 0.05,
      rockAxisWarmthPerMeter: -0.03,
      rockTextureWarmth: 0.24,
      rockContrast: 0.52,
      grassWarmth: 0.34,
      grassTextureWarmth: 0.28,
      grassContrast: 0.5,
    },
    bands: {
      terrain: {
        floorWarmth: 0,
        ceilingWarmth: 0.48,
      },
      vegetation: {
        floorWarmth: 0.16,
        ceilingWarmth: 0.86,
      },
      rocks: {
        floorWarmth: 0,
        ceilingWarmth: 0.48,
      },
      grass: {
        floorWarmth: 0,
        ceilingWarmth: 0.54,
      },
      animals: {
        floorWarmth: 0.72,
        ceilingWarmth: 1,
      },
    },
    terrainTextureWarmth: 0.28,
    terrainContrast: 0.7,
    actorWarmth: 0.96,
    actorExtremityFalloff: 0.2,
    actorTextureWarmth: 0.07,
    actorContrast: 0.3,
    heatEmission: {
      strength: 0.05,
      reachPerBodyHeight: 1.2,
    },
  },
  magnetic: {
    intensity: 1,
    fieldDirectionDegreesFromNorth: 0,
    fieldElevationDegrees: 7.5,
    colors: {
      northColor: 0x000000,
      southColor: 0xffffff,
      zenithColor: 0xc4d7f6,
    },
  },
};
