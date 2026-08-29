/**
 * Purpose: Define the complete configuration of the Thermal Perception effect.
 * Context: Levels author radius, palette, and warmth targets while the module owns the ramp shape.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Shader injection, uniforms, validation, and material ownership stay elsewhere.
 */

export const THERMAL_PERCEPTION_SETTINGS = {
  // Normalized 0..1 ramp positions across the warmth value. Each value marks
  // where its palette color is fully reached; raising a value pushes that
  // color band toward warmer surfaces. The stops sit closer together than an
  // even split, so the warmth band the world actually occupies swings hue
  // quickly: small heat differences separate the way an infrared camera
  // separates them, while the ramp between the stops stays continuous.
  coldStopFraction: 0.14,
  coolStopFraction: 0.3,
  warmStopFraction: 0.46,
  hotStopFraction: 0.64,

  // Terrain warmth mapping from elevation and zone conditions. Ground is the
  // coldest substance in the world, so every value here is scaled to keep it
  // inside the violet-to-cyan end of the palette: the elevation span is set
  // so ordinary rolling hills fill that end, and the boosts are small enough
  // to shade it rather than climb out of it. What overshoots — mountain
  // flanks, mostly — is caught by the terrain's warmth band, not here.
  terrainWarmth: {
    // Warmth right at the waterline; deeper water reads colder from here, so
    // the channel carries its own gradient down into the coldest ramp stop.
    shorelineWarmth: 0.05,
    waterColdPerDepthMeter: 0.02,
    // Dry ground spans floor..floor+span across the reachable elevation
    // range. Rare mountains own the top of that range, so ordinary rolling
    // ground occupies only its lowest third of it, and the span stretches
    // that third across violet, blue, and cyan.
    landWarmthFloor: 0.06,
    landElevationWarmthSpan: 0.7,
    // Forest regions and steep faces hold a little extra warmth on top of
    // elevation, printing the zone layout into the heat image without
    // carrying the ground into the warm half of the ramp.
    forestWarmthBoost: 0.05,
    slopeWarmthBoost: 0.04,
  },

  // The body-relative shape of a living actor's heat, expressed in fractions
  // of that actor's own height so one authored core fits a 0.7 m fox and a
  // 1.6 m stag alike. Warmth peaks inside the core and falls away with
  // distance from it, which is what cools legs, snouts, tails, and antlers
  // while the torso stays the hottest thing in the world.
  actorBody: {
    coreHeightFraction: 0.62, // Height up the body where the core sits.
    coreRadiusFraction: 0.14, // Distance from the core still fully warm.
    extremityReachFraction: 0.5, // Distance at which the falloff completes.
    horizontalWeight: 0.55, // Body length counts less than body height.
  },

  // The organic thermal texture laid over the measured warmth. Its octaves
  // are turned against each other and stepped by a non-integer factor, so no
  // grid, checkerboard, or repeat can form; the quiet values then ease the
  // texture off the hottest surfaces so a living body core keeps its shape.
  texture: {
    featureSizeMeters: 2.6, // Largest patch size on ground, plants, and rocks.
    bodyFeatureFraction: 0.4, // The same, as a share of an actor's height.
    lacunarity: 2.17, // Non-integer: octave periods never line up.
    gain: 0.5, // Each finer octave contributes half of the last.
    quietWarmth: 0.8, // Warmth above which the texture starts easing off.
    quietAmount: 0.6, // Share of it removed at full heat.
  },

  // Where each surface's contrast curve is steepest. The curve fixes zero,
  // the pivot, and full heat in place and steepens in between, so putting the
  // pivot on the warmth a surface's own readings cluster around expands the
  // differences that carry its structure and leaves both ends unclipped.
  definition: {
    terrainPivot: 0.28,
    vegetationPivot: 0.5,
    rockPivot: 0.28,
    actorPivot: 0.75,
  },

  // Width of the soft knee at each end of a warmth band. Inside the knee the
  // reading approaches the band's edge asymptotically instead of clipping, so
  // a material stays in its own range without piling up into a flat plateau
  // at the edge of it.
  bandKneeWarmth: 0.08,

  // How a living body radiates into what surrounds it. The emitter is a
  // segment along the animal's own body axis rather than a point, so the
  // warm pool is elongated nose to tail and turns as the animal turns
  // instead of ringing it with a circle.
  heat: {
    maxSources: 4, // Matches the bounded count of visible animals.
    bodyHalfLengthFraction: 0.55, // Segment half length, as a share of height.
    coreHeightFraction: 0.45, // Height of the emitting axis above the ground.
    edgeIrregularityMeters: 0.9, // Texture displacement of the pool's edge.
  },

  // Instance world positions are quantized to this cell before hashing so all
  // parts of one plant or rock agree on a single stable warmth variation. A
  // cell near one plant's own footprint keeps neighbours in separate cells,
  // so a stand reads as many temperatures instead of clumping into shared ones.
  instanceHashCellMeters: 1,
} as const;

/** The six ramp colors from coldest to hottest surface. */
export interface ThermalPaletteColors {
  readonly coldestColor: number;
  readonly coldColor: number;
  readonly coolColor: number;
  readonly warmColor: number;
  readonly hotColor: number;
  readonly hottestColor: number;
}

/**
 * Base warmth, stable per-instance variation, and the internal gradient of
 * static surface props. The two per-metre values are signed and measured from
 * the instance's own base and axis, so one authored gradient reads the same on
 * a 0.6 m shrub and a 10 m tree: negative cools outward and upward (a canopy
 * radiating to the sky), positive warms upward (a sun-facing rock top).
 */
export interface ThermalSurfaceWarmth {
  /** How far each surface's contrast curve is applied, 0..1. */
  readonly vegetationContrast: number;
  readonly rockContrast: number;
  readonly vegetationWarmth: number;
  readonly vegetationWarmthSpread: number;
  readonly vegetationHeightWarmthPerMeter: number;
  readonly vegetationAxisWarmthPerMeter: number;
  readonly vegetationTextureWarmth: number;
  readonly rockWarmth: number;
  readonly rockWarmthSpread: number;
  readonly rockHeightWarmthPerMeter: number;
  readonly rockAxisWarmthPerMeter: number;
  readonly rockTextureWarmth: number;
}

/**
 * The temperature range one material's own substance may occupy. Everything a
 * surface computes for itself — its base warmth, its internal gradient, its
 * texture, its contrast — is folded into this band, so ground cannot reach
 * the colors that belong to a living body however its own values add up.
 * Warmth borrowed from a nearby heat source is added afterwards and is the
 * one thing allowed to carry a surface beyond its own range.
 */
export interface ThermalWarmthBand {
  readonly floorWarmth: number;
  readonly ceilingWarmth: number;
}

/** Level-authored strength, sensing radius, palette, and warmth targets. */
export interface ThermalPerceptionParameters {
  /** Sense strength 0..1; the composition root skips the effect at zero. */
  readonly intensity: number;

  /** The heat view exists only inside this distance around the viewer. */
  readonly radiusMeters: number;

  /** Blend width of the fade back into the carried base color at the edge. */
  readonly edgeFeatherMeters: number;
  readonly colors: ThermalPaletteColors;
  readonly surfaces: ThermalSurfaceWarmth;

  /** Depth of the organic texture laid over the sampled ground warmth. */
  readonly terrainTextureWarmth: number;

  /** How far the ground's contrast curve is applied, 0..1. */
  readonly terrainContrast: number;

  /** Peak warmth at a living animal's body core; the hottest reading there is. */
  readonly actorWarmth: number;

  /** Warmth lost from that core out to the coolest extremity. */
  readonly actorExtremityFalloff: number;

  /** Depth of the organic texture across a living body. */
  readonly actorTextureWarmth: number;

  /** How far a living body's contrast curve is applied, 0..1. */
  readonly actorContrast: number;

  /** The temperature range each material's own substance may occupy. */
  readonly bands: {
    readonly terrain: ThermalWarmthBand;
    readonly vegetation: ThermalWarmthBand;
    readonly rocks: ThermalWarmthBand;
    readonly animals: ThermalWarmthBand;
  };

  /** Warmth each living body radiates onto the surfaces around it. */
  readonly heatEmission: {
    /** Added warmth at the body itself, before the distance falloff. */
    readonly strength: number;

    /** How far the warmth reaches, as a multiple of the animal's height. */
    readonly reachPerBodyHeight: number;
  };
}

/** One warm body radiating into the surfaces around it. */
export interface ThermalHeatSource {
  readonly x: number;
  readonly y: number;
  readonly z: number;

  /** Facing, so the pool follows the body axis instead of ringing it. */
  readonly headingRadians: number;
  readonly heightMeters: number;
}
