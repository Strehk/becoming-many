/**
 * Purpose: Author the motion sense every motion-carrying level and the show share.
 * Context: The ladder carries a sense forward unchanged, except that heat repaints the bird trail.
 * Responsibility: Own the one copy of these values and the one authored deviation from them.
 * Boundary: Data only; no runtime resources and no level presentation.
 */

import type { MotionSenseParameters } from "../../modules/motion-sense/motion-sense";

/** Typed on its own so the heat variant below can rebuild it without a guard. */
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
};

/**
 * The ladder's one deviation: from Thermal Perception on, a bird is a warm body.
 * Its trace takes the palette's hot stop, and it is here that a body joins the
 * trace at all — movement without one is what Motion Perception is about. The
 * flies keep their own colors and stay bodiless.
 */
export const HEAT_MOTION_SENSE: MotionSenseParameters = {
  ...MOTION_SENSE,
  birds: {
    ...BIRDS,
    appearance: {
      ...BIRDS.appearance,
      trailColor: 0xfb5f16,
    },
    // A blackbird's length, and the fur color the walking animals carry: the
    // flocks circle beyond the heat view's reach, so a bird reads in the echo
    // palette like an unwarmed animal rather than as a warm body up close.
    body: {
      lengthMeters: 0.26,
      color: 0x171717,
    },
  },
};
