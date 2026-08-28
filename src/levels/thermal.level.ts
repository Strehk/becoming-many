/**
 * Purpose: Define the Thermal Perception level preset ("Snake", level 05).
 * Context: Thermal Perception (level 05) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";

// Level 05 palette from docs/levels/README.md: #2E1386 #0C47D1 #2EB4E8
// #D5198A #FB5F16 #FCCE43, mapped cold to hot. The heat view exists only
// inside a viewer-centred radius; outside it the carried Motion world shows
// unchanged. Senses layer, never swap: every block below the thermal field
// is carried verbatim from motion.level.ts.
export const level: LevelPreset = {
  // Background equals the carried echo ramp haze stop, so far geometry
  // dissolves into it.
  backgroundColor: 0xf1f1f1,
  viewDistance: 128,
  testUi: true,
  terrain: {
    opacity: 1,
  },
  // Base module colors and densities match echo.level.ts; the world stays
  // as it was when depth vision was dominant.
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
  // New in level 05: warm bodies against the carried grayscale world. Fur
  // colors come from the level-03 dark stops so animals outside the thermal
  // radius sit inside the echo palette like vegetation does.
  animals: {
    colors: {
      furColor: 0x171717,
      lightFurColor: 0x494949,
      darkFurColor: 0x101010,
      featureColor: 0x101010,
    },
  },
  // Senses layer, never swap: the White World air layer and the Scent World
  // layer stay present underneath the thermal response.
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
  scentParticles: {
    colors: [0xb8e0e1, 0x9dd2c8, 0xd1c1d7, 0xfda39d, 0xfdbb54],
    placement: {
      emittersPerChunk: 2,
      minHeightMeters: 1,
      maxHeightMeters: 2,
    },
    emission: {
      particlesPerEmitter: 192,
      cloudRadiusMeters: 3,
      cloudHeightMeters: 1,
    },
    appearance: {
      sizeMeters: 0.15,
    },
    motion: {
      riseHeightMeters: 1.5,
      riseDurationSeconds: 10,
      driftAmplitudeMeters: 0.4,
      speedMultiplier: 1,
    },
  },
  // The depth ramp carries over from motion.level.ts unchanged: it stays the
  // ground the heat view feathers back into outside the thermal radius.
  echoDepth: {
    intensity: 1,
    nearDistanceMeters: 6,
    farDistanceMeters: 120,
    colors: {
      nearColor: 0x101010,
      nearShadeColor: 0x171717,
      midColor: 0x494949,
      farColor: 0xd7d7d7,
      hazeColor: 0xf1f1f1,
    },
  },
  // Motion trails carry over from motion.level.ts unchanged; thermal values
  // appear on top of the world the trails print against.
  motion: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    swarms: {
      // Twelve clouds spread the near-to-far rings; 720 flies total.
      swarmCount: 12,
      fliesPerSwarm: 60,
      flightSpeedMultiplier: 1,
    },
    appearance: {
      // Ink-dark specks and indigo trails from the level-04 dark stops; the
      // proven bm-base contrast read against the pale haze.
      flyColor: 0x212133,
      flySizeMeters: 0.07,
      trailColor: 0x312758,
      trailSizeMeters: 0.055,
      trailOpacity: 1,
    },
    trail: {
      // Ring depth of fourteen rendered frames keeps trails short and airy.
      lifetimeFrames: 14,
      expansionDistanceMeters: 0.22,
      // Full print intensity from roughly four centimetres moved per frame.
      motionGain: 26,
      fadePower: 1.6,
      density: 1,
    },
    birds: {
      // Three invisible flocks circle the traveler on 30-90 metre air rings;
      // only their traces are real ("swarm traces in the air").
      flockCount: 3,
      birdsPerFlock: 12,
      flightSpeedMetersPerSecond: 8,
      flightHeightMeters: 14,
      appearance: {
        // The cyan accent reserved for the bird traces; larger prints than
        // the fly trails so distant swarms stay readable against the haze.
        trailColor: 0x10bedb,
        trailSizeMeters: 0.18,
        trailOpacity: 1,
      },
    },
  },
  thermal: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    // Heat is a near sense: the false-color view reaches 30 metres and
    // feathers back into the echo ramp well inside its 120 m far distance.
    radiusMeters: 30,
    edgeFeatherMeters: 10,
    colors: {
      coldestColor: 0x2e1386,
      coldColor: 0x0c47d1,
      coolColor: 0x2eb4e8,
      warmColor: 0xd5198a,
      hotColor: 0xfb5f16,
      hottestColor: 0xfcce43,
    },
    surfaces: {
      // Plants hold mid warmth with visible per-plant variation; rocks sit
      // cooler and more uniform so living things stand out against them.
      vegetationWarmth: 0.45,
      vegetationWarmthSpread: 0.12,
      rockWarmth: 0.3,
      rockWarmthSpread: 0.08,
    },
    // Warm-blooded animals reach the hottest palette bands.
    actorWarmth: 0.92,
  },
};
