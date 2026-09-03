/**
 * Purpose: Define the isolated visual-design test level.
 * Context: Colors and later textures need a stable scene separate from diagnostics.
 * Responsibility: Author the complete visual color contract for every active module.
 * Boundary: Zone Visualizer stays in test.level; this file creates no runtime resources.
 */

import type { LevelPreset } from "./level-preset";

export const level: LevelPreset = {
  backgroundColor: 0xeaf0fb,
  viewDistance: 180,
  maximumGroundClearanceMeters: 50,
  testUi: true,
  airParticles: {
    density: {
      // Thinner than the narrative layer, recolored into the design palette.
      particlesPerChunk: 80,
    },
    appearance: {
      color: 0x292a32,
      sizeMeters: 0.075,
    },
    motion: {
      horizontalAmplitudeMeters: 0.12,
      verticalAmplitudeMeters: 0.24,
      speedMultiplier: 1,
    },
  },
  terrain: {
    opacity: 1,
    colors: {
      lowElevationColor: 0x51417d,
      highElevationColor: 0xc3c5d1,
      waterColor: 0x9bdedb,
    },
  },
  grass: {
    rootColor: 0x49328b,
    tipColor: 0x67d6ad,
    zones: {
      meadow: { tuftsPerSquareMeter: 1.5, bladeHeightMeters: 0.75 },
      shrubSlope: { tuftsPerSquareMeter: 0.4, bladeHeightMeters: 0.22 },
    },
  },
  vegetation: {
    colors: {
      trunkColor: 0x51447b,
      leafColor: 0x493276,
      leafAccentColor: 0x68728f,
      flowerColor: 0xf4d36f,
    },
    instancesPerHectareByZone: {
      meadow: 12,
      coniferForest: 150,
      deciduousForest: 150,
      shrubSlope: 70,
    },
  },
  rocks: {
    colors: {
      darkColor: 0x37354f,
      lightColor: 0x739fa8,
    },
    instancesPerHectareByZone: {
      meadow: 8,
      coniferForest: 10,
      deciduousForest: 10,
      shrubSlope: 60,
    },
  },
  animals: {
    colors: {
      furColor: 0xf3d34f,
      lightFurColor: 0xffee8a,
      darkFurColor: 0xd99b3f,
      featureColor: 0x4a405d,
    },
  },
};
