/**
 * Purpose: Author the motion sense every motion-carrying level and the show share.
 * Context: The ladder carries a sense forward unchanged, except that heat repaints the bird trail.
 * Responsibility: Own the one copy of these values and the one authored deviation from them.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { MotionSenseParameters } from "../../modules/motion-sense/motion-sense";

/** Typed on its own so the heat variant below can rebuild it without a guard. */
/*
 * One raptor, holding a ring over a place in the landscape. Its trace is
 * longer-lived than a flock's: a bird that crosses the whole sky in one slow
 * circle draws a line, and a line needs the frames to stay drawn.
 */
const RAPTOR: NonNullable<MotionSenseParameters["raptor"]> = {
  trailLifetimeFrames: 300,
  appearance: {
    trailColor: 0x2f6f8f,
    trailSizeMeters: 0.5,
    trailOpacity: 0.5,
  },
};

const BIRDS: NonNullable<MotionSenseParameters["birds"]> = {
  flockCount: 5,
  birdsPerFlock: 12,
  flightSpeedMetersPerSecond: 7.44,
  trailLifetimeFrames: 40,
  flightHeightMeters: 14,
  appearance: {
    trailColor: 0x10bedb,
    trailSizeMeters: 0.18,
    trailOpacity: 1,
  },
};

export const MOTION_SENSE: MotionSenseParameters = {
  intensity: 1,
  swarms: {
    swarmCount: 12,
    fliesPerSwarm: 60,
    flightSpeedMultiplier: 0.93,
  },
  appearance: {
    flyColor: 0x212133,
    flySizeMeters: 0.12,
    trailColor: 0x312758,
    trailSizeMeters: 0.085,
    trailOpacity: 1,
  },
  trail: {
    lifetimeFrames: 14,
    expansionDistanceMeters: 0.22,
    motionGain: 26,
    fadePower: 1.6,
    density: 1,
  },
  birds: BIRDS,
  raptor: RAPTOR,
};

/**
 * The ladder's one deviation: from Thermal Perception on, a bird is a warm body
 * and its trace takes the palette's hot stop. The flies keep their own colors.
 */
export const HEAT_MOTION_SENSE: MotionSenseParameters = {
  ...MOTION_SENSE,
  raptor: {
    ...RAPTOR,
    appearance: { ...RAPTOR.appearance, trailColor: 0xfb5f16 },
    // New in level 05: the bird itself, not only the line it draws. The fur
    // colour the walking population carries — it holds its ring seventy
    // metres up, far outside the heat view's reach, so it reads in the echo
    // palette like a body the warmth has not arrived at.
    body: { color: 0x171717 },
  },
  birds: {
    ...BIRDS,
    appearance: {
      ...BIRDS.appearance,
      trailColor: 0xfb5f16,
    },
  },
};
