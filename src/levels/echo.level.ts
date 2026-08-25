/**
 * Purpose: Define the Echolocation level preset ("Bat — Depth", level 03).
 * Context: Echolocation (level 03) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";

export const level: LevelPreset = {
  // Background equals the ramp haze stop, so far geometry dissolves into it.
  backgroundColor: 0xf6f0e9,
  viewDistance: 128,
  testUi: true,
  terrain: {
    opacity: 1,
  },
  // Base module colors show only below full echo intensity; they are
  // authored from the dark end of the level-03 palette so a future
  // intensity ramp fades between related tones instead of clashing ones.
  vegetation: {
    colors: {
      trunkColor: 0x0e1017,
      leafColor: 0x0d1730,
      leafAccentColor: 0x3c4782,
      flowerColor: 0x3fa7e2,
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
      darkColor: 0x0d1730,
      lightColor: 0x3c4782,
    },
    instancesPerHectareByZone: {
      meadow: 8,
      coniferForest: 10,
      deciduousForest: 10,
      shrubSlope: 60,
    },
  },
  // Senses layer, never swap: the White World air layer and the Scent World
  // layer stay present while the depth response becomes dominant.
  // The air layer keeps the unchanged White World values; dark motes read
  // against the haze, not against near-dark forms.
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
  // Scent values match scent.level.ts with the level-02 signature colors;
  // clouds now anchor above the rendered ground.
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
  echoDepth: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    // The nearest band stays one solid silhouette tone during fast flight.
    nearDistanceMeters: 6,
    // Below the view distance, so chunk streaming happens inside the haze.
    farDistanceMeters: 120,
    // The fixed level-03 palette, near to far; every surface shows only its
    // depth-ramp color regardless of proximity.
    colors: {
      nearColor: 0x0e1017,
      nearShadeColor: 0x0d1730,
      midColor: 0x3c4782,
      farColor: 0xcbd9e5,
      hazeColor: 0xf6f0e9,
    },
  },
};
