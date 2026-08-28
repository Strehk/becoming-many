/**
 * Purpose: Define the current landscape development level.
 * Context: Terrain must be tested without becoming part of White World.
 * Responsibility: Activate the landscape test presentation and its required modules.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import {
  sharedAirParticles,
  sharedGrassZones,
  sharedRocksDensities,
  sharedVegetationDensities,
} from "./shared-level-values";

export const level: LevelPreset = {
  backgroundColor: 0xffffff,
  viewDistance: 180,
  testUi: true,
  airParticles: {
    ...sharedAirParticles,
    // Thinner than the narrative layer; diagnostics need an uncluttered view.
    density: {
      particlesPerChunk: 80,
    },
  },
  terrain: {
    opacity: 1,
    presentation: "zones",
    magneticSense: {
      fieldDirectionDegreesFromNorth: 0,
      lineSpacingMeters: 8,
      lineWidthMeters: 0.35,
      pulseWidthMeters: 0.1,
      lineOpacity: 0.2,
      flowSpeedMetersPerSecond: 8,
      intensity: 1,
    },
  },
  grass: {
    rootColor: 0x173a32,
    tipColor: 0x6fae7c,
    zones: sharedGrassZones,
  },
  vegetation: {
    colors: {
      trunkColor: 0x5f4636,
      leafColor: 0x4f8f45,
      leafAccentColor: 0x78b85a,
      flowerColor: 0xd65f8d,
    },
    instancesPerHectareByZone: sharedVegetationDensities,
  },
  rocks: {
    colors: {
      darkColor: 0x4a4e57,
      lightColor: 0x7c838c,
    },
    instancesPerHectareByZone: sharedRocksDensities,
  },
  animals: {
    colors: {
      furColor: 0x86593d,
      lightFurColor: 0xa69985,
      darkFurColor: 0x68452f,
      featureColor: 0x292929,
    },
  },
};
