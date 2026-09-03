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
  /*
   * A relocated swarm used to arrive at its new ring between two frames,
   * which reads as a cloud of insects popping into the air. A swarm now
   * shrinks its specks away, moves while it is invisible, and swells back in,
   * and the swarms take their turns one after another rather than all at
   * once: the stagger is what keeps a re-anchor from reading as the whole
   * layer blinking. Twelve swarms at this stagger spend under three seconds
   * moving, and travel of eighty metres is what triggers it.
   */
  swarmFadeSeconds: 0.55,
  swarmFadeStaggerSeconds: 0.12,
  groundClearanceMeters: 0.9, // Swarm centre height above the sampled ground.
  // Central-difference step fitting the ground plane every fly is held above.
  // Wide enough to read the hill a stray crosses, not the pebbles under it.
  groundSlopeSampleMeters: 2,
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
    lobeDriftFraction: 0.55, // How far a lobe wanders from its rest place, in core radii.
    lobeDriftRate: { minHertz: 0.03, maxHertz: 0.11 }, // Slow enough to read as the cloud breathing.
  },
  swarmCorePull: 2.6, // Spring holding the dense core together, at the core edge.
  // Past the core edge the hold relaxes to a gentle constant drift: the swarm
  // keeps asking, never harder, so flies thin out over a long distance.
  swarmDriftPull: 0.9, // The force a strayed fly feels, however far it has gone.
  swarmRelaxRadii: 0.5, // Core radii over which the core hold gives way to it.
  swarmDissolveRadii: 3, // Where the quadratic recapture finally takes over.
  swarmRecapturePull: 8, // Strength of that recapture; nothing leaves for good.
  swarmLobePull: 1.2, // Cohesion toward a fly's own drifting density lobe.
  swarmLobeReachRadii: 1.2, // Core radii at which lobe cohesion has halved.
  // How tightly the swarm holds one fly. The skew keeps most flies near one,
  // where they make the core; the loose few are the wanderers thinning out
  // into the surrounding air, and how loose they are sets how far they get.
  flyBinding: { minimum: 0.18, skewToHeld: 0.3 },
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
  /*
   * How far one flock's size may run from the authored average, as a fraction
   * of it. Every flock holding exactly the same number of birds read as one
   * flock drawn several times over; drawn sizes are normalized back onto the
   * authored total, so the pool and its buffers stay exactly as large as
   * `birdsPerFlock` across the flock count says.
   */
  birdFlockSizeVariation: 0.65,
  minBirdsPerFlock: 3, // Below this a flock reads as strays, not as a flock.
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

    /**
     * The average flock, not the size of every one: each flock draws its own
     * size around this, and the drawn sizes are normalized back onto
     * `flockCount * birdsPerFlock`, which stays the exact pool size.
     */
    readonly birdsPerFlock: number;

    /** Orbit speed along the flock's air ring. */
    readonly flightSpeedMetersPerSecond: number;

    /**
     * Ring depth of the bird trace, in rendered frames, authored apart from
     * the fly trail's: a bird crosses the sky and its trace is the line it
     * drew doing so, while a fly buzzes in place and a trace that long would
     * close its cloud into a solid. It sizes this ring on its own, so a
     * longer bird trace costs nothing on the fly layer.
     */
    readonly trailLifetimeFrames: number;

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
