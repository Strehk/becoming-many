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
  swarmRadiusMeters: 1.45, // Horizontal core scale of one fly cloud; density thins outward past it.
  swarmHeightMeters: 0.65, // Vertical core scale of one fly cloud.
  // Every swarm draws its own volume from these ranges, so no two clouds share
  // a silhouette: stretched and tilted axes plus a few drifting density lobes.
  swarmShape: {
    minAxisScale: 0.6, // Narrowest an axis is drawn, in core radii.
    maxAxisScale: 1.45, // Widest an axis is drawn, in core radii.
    lobesPerSwarm: 3, // Overlapping clumps that keep the core lopsided.
    lobeAngleJitter: 0.4, // Fraction of the even lobe spacing an angle may shift.
    lobeOffsetFraction: 0.55, // Lobe distance from the cloud centre, in core radii.
    minLobeSpread: 0.42, // Gaussian spread of one lobe's flies, in core radii.
    maxLobeSpread: 0.72,
    lobeDriftFraction: 0.3, // How far a lobe wanders from its rest place, in core radii.
    lobeDriftRate: { minHertz: 0.03, maxHertz: 0.11 }, // Slow enough to read as the cloud breathing.
  },
  swarmCorePull: 1.3, // Envelope pull at the core edge; gentle, never a wall.
  swarmOuterPull: 5.5, // Quadratic pull beyond the core that gathers strays back in.
  swarmLobePull: 1.2, // Cohesion toward a fly's own drifting density lobe.
  minFlightSpeed: 0.45, // Metres per second before the level multiplier.
  maxFlightSpeed: 1.8, // Metres per second before the level multiplier.
  maxForce: 13, // Acceleration clamp keeping the buzz integration stable.
  neighbourSamples: 8, // Strided flockmate samples per fly; never the full pairing.
  placementAttemptsPerAnchor: 16, // Bounded water-rejection retries per anchor.
  maxBoidStepSeconds: 0.05, // Clamps frame-time spikes out of the integration.
  anchorGroundFollowRate: 0.2, // Per-update fraction anchors settle toward the ground.
  trailIntensityFloor: 0.04, // Faint print for barely moving flies; thinned points stay at zero.
  // Bird flocks circle the traveler on air rings well above the fly layer.
  birdOrbitRadius: { minMeters: 30, maxMeters: 90 }, // Interpolated across the flock pool.
  birdAnchorFollowRate: 0.02, // Per-update fraction flock centres drift after the player.
  birdScatter: { radiusMeters: 6, heightMeters: 1.5 }, // Bird slots inside one flock.
  birdWingSpanMeters: 0.9, // Lateral wingtip distance printing the wing traces.
  birdFlapAmplitudeMeters: 0.28, // Vertical wingtip travel per flap.
  birdFlapFrequency: { minHertz: 4, maxHertz: 8 }, // Per-bird deterministic flap rate.
  birdPointsPerBird: 3, // Body plus two wingtips; the whole trace of one bird.
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

  /** Invisible bird flocks whose flight prints trails; omitted means no birds. */
  readonly birds?: {
    /** Orbit rings interpolate near to far across this count. */
    readonly flockCount: number;
    readonly birdsPerFlock: number;

    /** Orbit speed along the flock's air ring. */
    readonly flightSpeedMetersPerSecond: number;

    /** Flock centre height above the sampled ground. */
    readonly flightHeightMeters: number;
    readonly appearance: MotionTrailAppearance;
  };
}

/** The per-source trail appearance shared by the fly and bird trail rings. */
export interface MotionTrailAppearance {
  readonly trailColor: number;
  readonly trailSizeMeters: number;
  readonly trailOpacity: number;
}
