/**
 * Purpose: Define the Motion Perception level preset ("Frog and insects", level 04).
 * Context: Motion Perception (level 04) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";

// Level 04 moodboard palette: #212133 #312758 #45577A #10BEDB #E3DFDD #F3952D.
// The dark stops color the flies and their trails; the cyan and orange
// accents stay reserved for later motion actors (bird trails, exit cues).
// The world itself carries the Echolocation grayscale unchanged: senses
// layer, never swap, and the decided art direction keeps the pale haze as
// the ground the ink-dark motion language prints against.
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
  // Senses layer, never swap: the White World air layer and the Scent World
  // layer stay present underneath the motion response.
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
  // The depth ramp carries over from echo.level.ts unchanged: depth stays
  // readable while movement becomes the dominant signal on top of it.
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
  },
};
