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
 * Only the two warm animal stops are still the moodboard verbatim
 * (`#FDBB54`, `#FDA39D`). The six plant signatures were derived from the
 * moodboard's cool stops and then deepened — saturation up by half,
 * lightness down a fifth — because the pale originals read as dust rather
 * than as scent once the background went white. Each still sits on the hue
 * of the stop it came from rather than being introduced: undergrowth sits
 * under the conifer
 * mint, blossom above the birch violet, dead wood is the moodboard's pale
 * stop drained of warmth because there is no living scent left in it, and
 * the stag and rat are the amber and coral carried down for the animal that
 * is heavier and the one that is smaller. That pale stop was the background
 * when these were authored; the background is white now, and dead wood keeps
 * the tone as the quietest signature the palette has.
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
 *
 * The radii are wider than the plants' own crowns suggest, and the counts sit
 * a fifth above the first dense set, because both are what surrounds a plant
 * with its scent: the particles start on a ring around it rather than on its
 * axis, so a wider radius and more of them is what a traveler walking up on
 * the upwind side smells instead of clear air.
 */
export const sharedScentParticles: SharedBlock<"scentParticles"> = {
  plants: {
    // Resin, and the one plant that smells all the way down its trunk.
    conifer: {
      color: 0x55d1ba,
      particlesPerPlant: 84, // moderate: 24
      emissionBottomFraction: 0.25,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.34,
      riseHeightMeters: 2.2,
    },
    // Leaf, released from the round crown and not from the bare trunk.
    deciduous: {
      color: 0x6adadd,
      particlesPerPlant: 84, // moderate: 24
      emissionBottomFraction: 0.45,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.46,
      riseHeightMeters: 2.2,
    },
    // The tall, narrow, open crown the level already treats as its own
    // silhouette keeps its own signature here too.
    birch: {
      color: 0xb185c2,
      particlesPerPlant: 72, // moderate: 20
      emissionBottomFraction: 0.5,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.38,
      riseHeightMeters: 2,
    },
    // Undergrowth: low, wide against its own small height, and quiet.
    bush: {
      color: 0x50be81,
      particlesPerPlant: 40, // moderate: 12
      emissionBottomFraction: 0.1,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.85,
      riseHeightMeters: 0.7,
    },
    // The one plant in the set with blossoms, and the only one that earns a
    // stronger signature than its size would suggest.
    floweringBush: {
      color: 0xa865c7,
      particlesPerPlant: 52, // moderate: 16
      emissionBottomFraction: 0.1,
      emissionTopFraction: 1,
      emissionRadiusFraction: 0.95,
      riseHeightMeters: 0.9,
    },
    // Standing dead wood: bare branching, and almost nothing to smell. The
    // quietest signature in the set, and the only one that reads as a tone
    // rather than as a colour.
    deadWood: {
      color: 0xb2a17f,
      particlesPerPlant: 18, // moderate: 6
      emissionBottomFraction: 0.2,
      emissionTopFraction: 0.9,
      emissionRadiusFraction: 0.28,
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
    // Twenty prints a second still put a print every few centimetres at
    // walking pace, so the route reads as a line rather than as a dotted one,
    // and the ring holds a third fewer particles than at thirty.
    printsPerSecond: 20,
    // Long enough that a traveler arriving after the animal still finds
    // where it went, and well inside the 60-second animation loop.
    lifetimeSeconds: 25,
    emissionBottomFraction: 0.15,
    emissionTopFraction: 0.85,
    emissionRadiusFraction: 0.35,
    riseHeightMeters: 0.8,
    // A route is carried a little further than a plant's scent, but not much:
    // at fourteen metres the weather moved the whole route off the ground the
    // animal actually walked, and the trail stopped being something to follow.
    // A print is heavier than airborne scent — it clings to what it was left
    // on — so the wind now only leans it.
    windResponseMeters: 4,
  },
  appearance: {
    // A third smaller than the value that first made a single plant's scent
    // read as something in the air rather than as dust. At that size a wood
    // closed toward a wall of colour once the drift below opened out; the
    // finer point keeps the individual particles readable inside the plume.
    sizeMeters: 0.16,
  },
  motion: {
    riseDurationSeconds: 10, // Must divide the 60-second loop evenly.
    // Each particle drifts on its own phase and amplitude, and the drift
    // opens out with age, so this is the width reached late in a life rather
    // than one held throughout. Nearly two metres read as visible swirling
    // weather of its own rather than as scent hanging in the air, and it
    // fought the plume the wind draws. What the width lost, the shader took
    // back as rate: the drift now runs mostly on its faster turn, so this is
    // the reach of a churn rather than of a slow circle.
    driftAmplitudeMeters: 1.3,
    speedMultiplier: 1,
    // The wind has to beat the rise, or the scent only ever goes up. At the
    // first authored value a tree lifted its scent four times further than
    // the wind carried it, which read as slow floating rather than as
    // weather. Now the carry runs roughly two to four times the rise, so a
    // plant streams a plume downwind. The plume still starts at the plant —
    // carry scales with age, and age zero is no carry — so the source stays
    // the thing you can smell your way back to.
    windResponseMeters: 7,
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
 * The bird flocks, kept as a value of their own because level 05 carries the
 * whole Motion preset and repaints only these traces: in a heat view a flock
 * is a warm body, not the cold accent the pale world reads it as.
 */
export const sharedMotionSenseBirds: NonNullable<
  SharedBlock<"motion">["birds"]
> = {
  // Five invisible flocks circle the traveler on 30-90 metre air rings; only
  // their traces are real ("swarm traces in the air"). Three left the sky
  // empty in most directions, and the rings interpolate near to far across
  // the count, so more flocks also means more depths carrying one.
  flockCount: 5,
  // The average flock, not every flock: each draws its own size around this
  // and the draws are normalized back onto the pool, so the sky holds a few
  // large flocks and a few small ones instead of one size repeated.
  birdsPerFlock: 12,
  // Seven percent below the first authored speed, with everything else that
  // moves.
  flightSpeedMetersPerSecond: 7.44,
  // Far longer than the flies' fourteen: a bird crosses the sky, and at the
  // fly ring's depth its trace was a short dash that said nothing about where
  // it had come from. This is the line the flock drew getting here.
  trailLifetimeFrames: 40,
  flightHeightMeters: 14,
  appearance: {
    // The cyan accent reserved for the bird traces; larger prints than the
    // fly trails so distant swarms stay readable against the haze.
    trailColor: 0x10bedb,
    trailSizeMeters: 0.18,
    trailOpacity: 1,
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
    // Seven percent below the speed the swarms were first tuned at, with the
    // walking animals, which were all reading a shade hurried.
    flightSpeedMultiplier: 0.93,
  },
  appearance: {
    // Ink-dark specks and indigo trails from the level-04 dark stops; the
    // proven bm-base contrast read against the pale haze.
    flyColor: 0x212133,
    // Well above the speck the flies were: at seven centimetres a single
    // insect only registered once its trail had drawn it, and the swarm read
    // as a smudge rather than as bodies in the air.
    flySizeMeters: 0.12,
    trailColor: 0x312758,
    // Carried up with the flies, so a trail still reads as the thinner mark
    // behind a body rather than as a second body.
    trailSizeMeters: 0.085,
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
  birds: sharedMotionSenseBirds,
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
