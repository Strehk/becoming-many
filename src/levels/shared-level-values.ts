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
 * background color, so far geometry dissolves into it. It sits a little
 * above the luminance of the moodboard stop it was derived from: the haze is
 * what the world ends in, and lifting it nearer white thins the horizon
 * rather than closing it with a wall of grey.
 */
export const sharedEchoHazeColor = 0xf7f7f7;

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
 * The Scent World layer: every plant and every animal carries its own scent.
 *
 * Signatures are grouped by what a nose could plausibly tell apart, not by
 * asset, and the split runs along one line: the rooted plants take the cool
 * half of the level-02 palette, the moving bodies the warm half. That is the
 * one distinction the sense has to carry before any species reads — what
 * stands still and what walks.
 *
 * Three plant stops are the moodboard verbatim (`#9DD2C8`, `#B8E0E1`,
 * `#D1C1D7`) and two animal stops are (`#FDBB54`, `#FDA39D`). The remaining
 * five are deviations, and each is carried along the hue of the stop it
 * belongs to rather than introduced: undergrowth sits under the conifer
 * mint, blossom above the birch violet, dead wood is the pale background
 * stop drained of warmth because there is no living scent left in it, and
 * the stag and rat are the amber and coral carried down for the animal that
 * is heavier and the one that is smaller.
 *
 * The emission volume is authored in fractions of each plant's own height,
 * so one signature fits a knee-high bush and a ten-metre pine: a conifer
 * releases from a narrow column up its whole trunk, a deciduous crown only
 * from its round top half, and a bush from a wide, low blob. The rise is
 * per family for the same reason — a bush lifting its scent as far as a pine
 * would visibly leave the plant it belongs to.
 *
 * `particlesPerPlant` is the density and the frame cost. These are the dense
 * trial values; the measured, moderate set is recorded beside each one.
 */
export const sharedScentParticles: SharedBlock<"scentParticles"> = {
  plants: {
    // Resin, and the one plant that smells all the way down its trunk.
    conifer: {
      color: 0x9dd2c8,
      particlesPerPlant: 70, // moderate: 24
      emissionBottomFraction: 0.25,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.26,
      riseHeightMeters: 2.2,
    },
    // Leaf, released from the round crown and not from the bare trunk.
    deciduous: {
      color: 0xb8e0e1,
      particlesPerPlant: 70, // moderate: 24
      emissionBottomFraction: 0.45,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.38,
      riseHeightMeters: 2.2,
    },
    // The tall, narrow, open crown the level already treats as its own
    // silhouette keeps its own signature here too.
    birch: {
      color: 0xd1c1d7,
      particlesPerPlant: 60, // moderate: 20
      emissionBottomFraction: 0.5,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.3,
      riseHeightMeters: 2,
    },
    // Undergrowth: low, wide against its own small height, and quiet.
    bush: {
      color: 0x8fc2a6,
      particlesPerPlant: 32, // moderate: 12
      emissionBottomFraction: 0.1,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.72,
      riseHeightMeters: 0.7,
    },
    // The one plant in the set with blossoms, and the only one that earns a
    // stronger signature than its size would suggest.
    floweringBush: {
      color: 0xc3a7d0,
      particlesPerPlant: 42, // moderate: 16
      emissionBottomFraction: 0.1,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.8,
      riseHeightMeters: 0.9,
    },
    // Standing dead wood: bare branching, and almost nothing to smell.
    deadWood: {
      color: 0xc9c2b4,
      particlesPerPlant: 14, // moderate: 6
      emissionBottomFraction: 0.2,
      emissionTopFraction: 0.9,
      emissionRadiusFraction: 0.2,
      riseHeightMeters: 0.5,
    },
  },
  // The route an animal walked, printed where it walked it. Levels without
  // animals carry these values unused; the trail ring is only allocated
  // where the Animals module actually runs.
  animals: {
    signatures: {
      deer: { color: 0xfdbb54 },
      stag: { color: 0xef8f3c },
      fox: { color: 0xfda39d },
      rat: { color: 0xd8919c },
    },
    // Thirty prints a second put a print every few centimetres at walking
    // pace, so the route reads as a line rather than as a dotted one.
    printsPerSecond: 30,
    // Long enough that a traveler arriving after the animal still finds
    // where it went, and well inside the 60-second animation loop.
    lifetimeSeconds: 25,
    emissionBottomFraction: 0.15,
    emissionTopFraction: 0.85,
    emissionRadiusFraction: 0.35,
    riseHeightMeters: 0.8,
    // A route is carried much further than a plant's scent: nothing holds a
    // print in place once the animal has walked on, and the old end of the
    // trail has had the whole lifetime to travel.
    windResponseMeters: 6,
  },
  appearance: {
    // Smaller than the four-cloud layer this replaced: the scent now comes
    // from every plant, and the same point size would close the forest into
    // a wall of color instead of showing what stands in it.
    sizeMeters: 0.12,
  },
  motion: {
    riseDurationSeconds: 10, // Must divide the 60-second loop evenly.
    // Each particle now drifts on its own phase and its own amplitude, so
    // this is the middle of a spread rather than one shared circle. Raised
    // with it: at the old value the churn was too tight to read as air.
    driftAmplitudeMeters: 0.6,
    speedMultiplier: 1,
    // The scent leans off its plant and trails away, but not so far that the
    // plant stops being the thing you can smell your way back to. Raising
    // this past roughly two metres starts to tear the plume off its source.
    windResponseMeters: 1.4,
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
    // Lifted with the haze stop above it, so the two stay a pair: lightening
    // only the end the world dissolves into would have left the band before
    // it as a visible grey step short of the horizon.
    farColor: 0xe2e2e2,
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

/** The decided grass distribution, shared by every level that grows grass. */
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

/**
 * Grass in the carried echo world. Like Vegetation, its own colors show only
 * below full echo intensity, so root and tip are authored from the same
 * level-03 dark stops the plants around it use: a future intensity ramp then
 * fades between related tones instead of clashing ones.
 *
 * No narrative level selects this block at present. Grass is the densest
 * near-camera surface in the world, and Thermal Perception samples a
 * four-octave noise field per fragment on every surface it decorates, so the
 * two together were parked until that cost is measured. The block stays
 * authored so restoring grass is one line in `echo.level.ts`.
 */
export const sharedEchoGrass: SharedBlock<"grass"> = {
  rootColor: 0x101010,
  tipColor: 0x494949,
  zones: sharedGrassZones,
};
