/**
 * Purpose: Define the complete configuration of the Motion Sense effect.
 * Context: Levels author swarm density, appearance, and trail behavior; the module owns placement.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Simulation, geometry, materials, shaders, and lifecycle stay elsewhere.
 */

export const MOTION_SENSE_SETTINGS = {
  // Swarm rings interpolate from near to far across the authored swarm count,
  // so some clouds are always experienceable while others sweep the distance.
  nearRing: { minMeters: 5, maxMeters: 18 },
  farRing: { minMeters: 35, maxMeters: 65 }, // Below the 128-metre view distance.
  reanchorDistanceMeters: 80, // Player travel that relocates every swarm anchor.
  groundClearanceMeters: 0.9, // Swarm centre height above the sampled ground.
  swarmRadiusMeters: 1.45, // Soft horizontal envelope of one fly cloud.
  swarmHeightMeters: 0.65, // Soft vertical half extent of one fly cloud.
  minFlightSpeed: 0.45, // Metres per second before the level multiplier.
  maxFlightSpeed: 1.8, // Metres per second before the level multiplier.
  maxForce: 13, // Acceleration clamp keeping the buzz integration stable.
  neighbourSamples: 8, // Strided flockmate samples per fly; never the full pairing.
  placementAttemptsPerAnchor: 16, // Bounded water-rejection retries per anchor.
  maxBoidStepSeconds: 0.05, // Clamps frame-time spikes out of the integration.
  anchorGroundFollowRate: 0.2, // Per-update fraction anchors settle toward the ground.
  trailIntensityFloor: 0.04, // Faint print for barely moving flies; thinned points stay at zero.
} as const;

/** Level-authored sense strength, swarm pool, appearance, and trail values. */
export interface MotionSenseParameters {
  /** Sense strength 0..1; the composition root skips the module at zero. */
  readonly intensity: number;
  readonly swarms: {
    /** Ring placement interpolates near to far across this count. */
    readonly swarmCount: number;
    readonly fliesPerSwarm: number;
    readonly flightSpeedMultiplier: number;
  };
  readonly appearance: {
    /** Ink-dark speck tone; reads against the pale haze, not the dark forms. */
    readonly flyColor: number;
    readonly flySizeMeters: number;
    readonly trailColor: number;
    readonly trailSizeMeters: number;
    readonly trailOpacity: number;
  };
  readonly trail: {
    /** Ring depth; trail length in rendered frames. */
    readonly lifetimeFrames: number;

    /** Outward drift of aging particles away from the printed cloud centre. */
    readonly expansionDistanceMeters: number;

    /** Metres moved between frames to print at full intensity. */
    readonly motionGain: number;

    /** Fade curve exponent; higher values die off faster. */
    readonly fadePower: number;

    /** Deterministic fraction of flies that print trails, 0..1. */
    readonly density: number;
  };
}
