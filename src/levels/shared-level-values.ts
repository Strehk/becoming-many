/**
 * Purpose: Define level values shared verbatim by multiple level presets.
 * Context: Later levels carry earlier worlds forward ("senses layer, never swap").
 * Responsibility: Hold each shared block once so level files compose instead of copy.
 * Boundary: This file contains data only; levels overwrite single values via spreads.
 */

import type { LevelPreset } from "./level-runtime";

type SharedBlock<Key extends keyof LevelPreset> = NonNullable<LevelPreset[Key]>;

/**
 * The echo ramp haze stop. Levels that carry the echo world use it as the
 * background color, so far geometry dissolves into it.
 */
export const sharedEchoHazeColor = 0xf1f1f1;

/**
 * The White World air layer: dark motes reading against a pale background.
 * It stays present as the neutral depth baseline in every later level.
 */
export const sharedAirParticles: SharedBlock<"airParticles"> = {
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
};

/**
 * The Scent World layer with the level-02 signature colors: forest chunks
 * spawn low, flat clouds anchored above the rendered ground. The pale base
 * tone stays reserved for the background.
 */
export const sharedScentParticles: SharedBlock<"scentParticles"> = {
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
};

/** The decided population densities, shared by every level that renders the landscape. */
export const sharedVegetationDensities: SharedBlock<"vegetation">["instancesPerHectareByZone"] =
  {
    meadow: 12,
    coniferForest: 150,
    deciduousForest: 150,
    shrubSlope: 70,
  };

/** The decided population densities, shared by every level that renders the landscape. */
export const sharedRocksDensities: SharedBlock<"rocks">["instancesPerHectareByZone"] =
  {
    meadow: 8,
    coniferForest: 10,
    deciduousForest: 10,
    shrubSlope: 60,
  };

/**
 * Vegetation in the carried echo world. Base module colors show only below
 * full echo intensity; they are authored from the dark end of the level-03
 * palette so a future intensity ramp fades between related tones instead of
 * clashing ones.
 */
export const sharedEchoVegetation: SharedBlock<"vegetation"> = {
  colors: {
    trunkColor: 0x101010,
    leafColor: 0x171717,
    leafAccentColor: 0x494949,
    flowerColor: 0x959595,
  },
  instancesPerHectareByZone: sharedVegetationDensities,
};

/** Rocks in the carried echo world, colored from the same level-03 dark stops. */
export const sharedEchoRocks: SharedBlock<"rocks"> = {
  colors: {
    darkColor: 0x171717,
    lightColor: 0x494949,
  },
  instancesPerHectareByZone: sharedRocksDensities,
};

/**
 * The Echolocation depth response, carried unchanged by every later level as
 * the ground the newer senses print against.
 */
export const sharedEchoDepth: SharedBlock<"echoDepth"> = {
  // Full sense strength until a dramaturgy driver exists.
  intensity: 1,
  // The nearest band stays one solid silhouette tone during fast flight.
  nearDistanceMeters: 6,
  // Below the view distance, so chunk streaming happens inside the haze.
  farDistanceMeters: 120,
  // Grayscale ramp, near to far, keeping the luminance steps of the
  // moodboard palette; every surface shows only its depth-ramp color
  // regardless of proximity.
  colors: {
    nearColor: 0x101010,
    nearShadeColor: 0x171717,
    midColor: 0x494949,
    farColor: 0xd7d7d7,
    hazeColor: sharedEchoHazeColor,
  },
};

/**
 * The Motion Perception response, carried unchanged after level 04: fly
 * swarms and invisible bird flocks printing trails onto the carried world.
 */
export const sharedMotionSense: SharedBlock<"motion"> = {
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
};

/** The decided grass distribution, shared by every level that renders grass. */
export const sharedGrassZones: SharedBlock<"grass">["zones"] = {
  // The shader gives every tuft a random 0.4..1.0 of its authored height, so
  // the authored value is the tallest tuft, not the average one: a meadow set
  // to 1 metre reads at roughly 0.7.
  // The largest density here fixes the GPU capacity for every zone, so raising
  // meadow alone resizes the whole instance buffer. See the grass README for
  // what that costs.
  meadow: {
    tuftsPerSquareMeter: 14,
    bladeHeightMeters: 1.35,
  },
  shrubSlope: {
    tuftsPerSquareMeter: 5,
    bladeHeightMeters: 0.45,
  },
};
