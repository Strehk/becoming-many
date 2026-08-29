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
};

/**
 * The Scent World layer with the level-02 signature colors: forest chunks
 * spawn low, flat clouds anchored above the rendered ground. The pale base
 * tone stays reserved for the background.
 *
 * Every emitter renders the same box at the same particle count, so variety
 * comes from the placement instead: many small clouds per chunk land
 * independently, and where they overlap they read as one larger, denser
 * mass. The clouds are flat so they can sit close to the ground, which
 * leaves the sway alone to carry the box edges into an undulating
 * silhouette.
 *
 * The anchor height is drawn uniformly between its two ends, so the range
 * stays low and narrow. Its top end is the only lever on how high a cloud
 * sits, and raising it lifts the whole layer instead of a few clouds in it.
 */
export const sharedScentParticles: SharedBlock<"scentParticles"> = {
  colors: [0xb8e0e1, 0x9dd2c8, 0xd1c1d7, 0xfda39d, 0xfdbb54],
  placement: {
    emittersPerChunk: 4,
    minHeightMeters: 0.7,
    maxHeightMeters: 1.3,
  },
  emission: {
    particlesPerEmitter: 90,
    cloudRadiusMeters: 2.8,
    cloudHeightMeters: 1,
  },
  appearance: {
    sizeMeters: 0.15,
  },
  motion: {
    riseHeightMeters: 1.5,
    riseDurationSeconds: 10,
    driftAmplitudeMeters: 0.9,
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
  // Well below the view distance: the landscape reaches full haze at 96 m and
  // the last 32 m before the far plane hold nothing but haze, so the world
  // dissolves into mist instead of ending at a visible cut.
  farDistanceMeters: 96,
  // Grayscale ramp, near to far, walking every luminance step of the
  // moodboard palette in order so the mist thickens evenly with distance
  // instead of holding a dark mass out to mid range; every surface shows
  // only its depth-ramp color regardless of proximity.
  colors: {
    nearColor: 0x101010,
    nearShadeColor: 0x494949,
    midColor: 0x959595,
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

/** The decided grass distribution, shared by the diagnostic and design test levels. */
export const sharedGrassZones: SharedBlock<"grass">["zones"] = {
  meadow: {
    tuftsPerSquareMeter: 1.5,
    bladeHeightMeters: 0.75,
  },
  shrubSlope: {
    tuftsPerSquareMeter: 0.4,
    bladeHeightMeters: 0.22,
  },
};
