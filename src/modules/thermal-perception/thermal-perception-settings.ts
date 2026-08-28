/**
 * Purpose: Define the complete configuration of the Thermal Perception effect.
 * Context: Levels author radius, palette, and warmth targets while the module owns the temperature model.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Shader injection, uniforms, validation, and material ownership stay elsewhere.
 *
 * The temperature model in one place, so the budget below can be read as a
 * whole. Every sensed surface reaches its final warmth the same way:
 *
 *   material baseline          what this kind of surface is, before anything local
 * + environmental variation    elevation, exposure, canopy shade, water depth
 * + within-object structure    per-vertex: body core, canopy height, blade root
 * + spatial detail             per-fragment: two octaves of continuous noise
 * + localized hotspots         the high tail of that same noise field
 * + external heat sources      warm bodies bleeding into the ground under them
 *
 * The first three terms are measured in the vertex stage and interpolated; the
 * last three are measured per fragment, which is the only place a temperature
 * field can be finer than the mesh carrying it.
 *
 * The warmth axis is split into two bands that must not overlap. Everything
 * that is not alive passes through a soft ceiling (`environmentCeiling`) that
 * it approaches but never reaches; living bodies start above it. That is what
 * keeps a sunlit slope from reading hotter than a deer standing on it.
 */

/**
 * Ground heat pools are read from a fixed-size uniform array, so the count is a
 * compile-time constant shared with `thermal-ground-heat.glsl`. Changing it
 * requires changing the array size in that file; a regression test locks the
 * two together. Extra sources beyond the capacity are ignored.
 */
export const THERMAL_GROUND_HEAT_SOURCE_COUNT = 4;

/**
 * One surface kind's fragment-stage detail. Two octaves rather than one: the
 * coarse one gives a patch its shape, the fine one gives it grain, and a
 * surface that carries only one of them still reads as a painted region.
 */
export interface ThermalDetailSettings {
  readonly coarseWavelengthMeters: number;
  readonly fineWavelengthMeters: number;
  readonly coarseWarmth: number;
  readonly fineWarmth: number;

  /**
   * Strength of the localized hotspots taken from the high tail of the coarse
   * octave, so they land as small, smoothly-blended, gradually-falling patches
   * instead of thresholded blobs with an edge.
   */
  readonly hotspotWarmth: number;

  /**
   * How much a surface slot's own authored tone shifts its temperature. A
   * thermal camera has no albedo, so the material differences that a lit scene
   * would show as color must show as temperature instead: this is what keeps a
   * trunk from reading identical to the foliage around it.
   */
  readonly toneWarmth: number;
}

export const THERMAL_PERCEPTION_SETTINGS = {
  ramp: {
    // Normalized 0..1 ramp positions across the warmth value. Each value marks
    // where its palette color is fully reached. The stops are deliberately
    // evenly spaced: the segment easing below is only C1 across a join when
    // neighbouring segments are the same width.
    coldStopFraction: 0.2,
    coolStopFraction: 0.4,
    warmStopFraction: 0.6,
    hotStopFraction: 0.8,

    // Softens the slope corner at every stop without ever flattening the
    // gradient. Zero is the raw piecewise-linear ramp, whose corners read as
    // Mach bands; one would stall the gradient at each stop and produce the
    // color plateaus this ramp exists to avoid. See the easing comment in the
    // fragment shader for the curve.
    segmentEase: 0.45,

    // The sense radius is a circle around the viewer, and a circle is exactly
    // the shape this level must not show. The feather boundary is displaced by
    // the detail field by this much, so the heat view ends in a ragged front.
    edgeBreakupMeters: 3.5,
  },

  /**
   * The soft ceiling every surface that is not alive passes through. Below the
   * knee it changes nothing; above it the value approaches the ceiling
   * asymptotically, so an accumulation of boosts compresses instead of
   * clipping. Nothing dead ever reaches the ceiling, and the coldest part of a
   * living body starts above it.
   */
  environmentCeiling: {
    kneeWarmth: 0.55,
    ceilingWarmth: 0.74,
  },

  detail: {
    // The fine octave is finer than a pixel at distance and would shimmer, so
    // it fades out across this band. The coarse octave carries on to the
    // horizon.
    fadeStartMeters: 14,
    fadeEndMeters: 38,

    // Where the coarse octave stops being texture and starts being a hotspot.
    // Raising it makes hotspots rarer and smaller.
    hotspotThreshold: 0.52,
  },

  // Terrain warmth mapping from elevation, exposure, and zone conditions.
  terrainWarmth: {
    // Warmth right at the waterline; deeper water reads colder from here.
    shorelineWarmth: 0.11,
    waterColdPerDepthMeter: 0.05,

    // Dry ground starts at the floor and gains warmth from solar exposure.
    // Floor, exposure, and mottling together reach 0.62, comfortably under the
    // environment ceiling: the ground pools that warm bodies leave behind then
    // have somewhere to go instead of clipping at the top of the ramp.
    landWarmthFloor: 0.2,
    landElevationWarmthSpan: 0.19,
    slopeWarmthBoost: 0.08,

    // Canopy shade scales the exposure terms rather than subtracting from the
    // floor, so shaded forest ground reads cooler than open ground at the same
    // elevation while dry land still never drops into the water band.
    canopyShadeFraction: 0.5,

    // Mottling breaks the large flat regions elevation and zone facts produce.
    // It only ever adds warmth: land therefore never reaches down into the
    // water band and the semantic order of water, low ground, and high ground
    // survives unchanged.
    landMottleWarmth: 0.15,
    waterMottleWarmth: 0.05,
    // Two octaves, both well above the 2-metre terrain vertex spacing. Nothing
    // finer belongs here — below roughly eight metres a vertex attribute
    // aliases instead of reading as mottling, which is why everything finer
    // than this is measured per fragment instead.
    mottleWavelengthMeters: 34,
    mottleDetailWavelengthMeters: 11,
    mottleDetailShare: 0.42,

    detail: {
      coarseWavelengthMeters: 2.6,
      fineWavelengthMeters: 0.7,
      coarseWarmth: 0.075,
      fineWarmth: 0.032,
      hotspotWarmth: 0.035,
      // Terrain draws with one flat material color, so there is no slot tone
      // to read: its variation is entirely elevation, exposure, and noise.
      toneWarmth: 0,
    } satisfies ThermalDetailSettings,
  },

  /**
   * How much of a surface's own tone survives the false color as brightness.
   * Kept low on purpose: a thermal camera has no albedo, so per-part identity
   * belongs in the temperature (see `toneWarmth`) rather than in a shade that
   * darkens the palette. What remains is only enough to keep a dark slot from
   * looking like a pale one at the same temperature.
   */
  surfaceLuminance: {
    referenceLuminance: 0.3,
    structureAmount: 0.28,
    minimumShade: 0.62,
    maximumShade: 1.18,
  },

  /**
   * The one geometric light this sense adds. Nothing else in the piece is lit,
   * so without it a leaf's upper face and its underside are indistinguishable
   * and foliage reads as a flat cutout. Kept moderate on purpose: double-sided
   * foliage cards carry an inverted normal on their back faces, and a gentle
   * gradient makes those read as slightly odd rather than wrong. Terrain has
   * no normal attribute and sits this out at the neutral value.
   */
  surfaceShade: {
    groundShade: 0.6,
    skyShade: 1.12,
  },

  // Instance world positions are quantized to this cell before hashing so all
  // parts of one plant or rock agree on a single base warmth, which the
  // within-instance structure below then varies across the model.
  instanceHashCellMeters: 2,

  /**
   * Temperature structure inside one plant or rock. The height and axis terms
   * are zero-mean deviations, so the level-authored base warmth stays the
   * average temperature of the instance: ground-warmed trunks and inner
   * volumes read warmer, sky-facing canopy and outer foliage read cooler.
   */
  propStructure: {
    heightReferenceMeters: 6,
    heightWarmthHalfDrop: 0.095,
    // Tight enough that the gradient completes inside the canopy rather than
    // running past it, so outer foliage actually reaches the cool end.
    axisReferenceMeters: 2,
    axisWarmthHalfDrop: 0.07,
    // Branch and leaf-cluster scale. Model vertices carry this, so unlike the
    // fragment detail it is limited by the GLB's own density.
    grainWavelengthMeters: 0.9,
    grainWarmth: 0.055,
    grazingCoolness: 0.11,

    // Every instance of one model otherwise samples the detail field at the
    // same model-local coordinates and comes out identically textured. This
    // pushes each instance to its own place in the field, so two neighbouring
    // plants of the same species never share a temperature pattern.
    detailPhaseMeters: 37,

    detail: {
      coarseWavelengthMeters: 0.34,
      fineWavelengthMeters: 0.085,
      coarseWarmth: 0.05,
      fineWarmth: 0.026,
      hotspotWarmth: 0.045,
      toneWarmth: 0.17,
    } satisfies ThermalDetailSettings,
  },

  /**
   * Temperature structure inside one animal, as fractions of the species' own
   * body height so the same profile fits a rat and a stag. A thermal image of
   * a standing quadruped is dominated by one fact: temperature falls off with
   * height away from the torso, hard downward into the legs and gently upward
   * through the neck. Both lobes are therefore bands in normalized height,
   * which is the one body coordinate that survives the actor's heading without
   * the sense having to learn which way a species faces.
   */
  actorStructure: {
    // How far below the authored core temperature the coolest skin sits. The
    // authored value is the torso; hooves and ear tips land at the far end.
    warmthRange: 0.3,

    // The torso band: full core temperature through its inner width, falling
    // to the cool end by its outer width. A deer's belly sits near 0.54 and
    // its back near 0.75 of body height, so the band covers the whole trunk.
    coreHeightFraction: 0.66,
    coreInnerFraction: 0.1,
    coreOuterFraction: 0.32,

    // The head and neck carry their own, narrower lobe just under the top of
    // the body, slightly below core temperature.
    headHeightFraction: 0.92,
    headInnerFraction: 0.05,
    headOuterFraction: 0.18,
    headWarmthShare: 0.88,

    // Ears, antler tips, and the crown of the head are thin and radiate: the
    // topmost slice cools back off again.
    tipStartFraction: 0.93,
    tipCoolShare: 0.4,

    grainWavelengthMeters: 0.32,
    grainWarmth: 0.035,
    grazingCoolness: 0.12,

    detail: {
      coarseWavelengthMeters: 0.16,
      fineWavelengthMeters: 0.05,
      coarseWarmth: 0.034,
      fineWarmth: 0.019,
      // The strongest hotspots in the scene, and weighted by the body profile,
      // so the warm patches land around the torso and face rather than on the
      // hooves.
      hotspotWarmth: 0.085,
      toneWarmth: 0.11,
    } satisfies ThermalDetailSettings,
  },

  /**
   * Grass, the one sensed surface that never stops moving. Its roots sit in
   * still air against warm ground and its tips radiate to the sky, and the
   * shimmer rides the blade's own sway rather than a clock, so the heat field
   * itself stays static while the grass twinkles.
   */
  grassStructure: {
    rootWarmthBoost: 0.13,
    shimmerWarmth: 0.06,
    rootShade: 0.55,

    detail: {
      // Sampled in world space, so these two octaves are what makes one tuft
      // read warmer than the tuft beside it: the sward has no per-blade warmth
      // source of its own.
      coarseWavelengthMeters: 1.7,
      fineWavelengthMeters: 0.4,
      coarseWarmth: 0.075,
      fineWarmth: 0.03,
      hotspotWarmth: 0.025,
      // One authored root and tip color for the whole sward; the gradient
      // between them is already the blade structure, not a slot identity.
      toneWarmth: 0,
    } satisfies ThermalDetailSettings,
  },

  /**
   * Warm bodies bleed heat into the ground under them. Measured per fragment
   * rather than per vertex: at the 2-metre terrain vertex spacing a pool this
   * small resolves as a triangle, and the previous vertex-stage version is
   * exactly what read as a flat disc. The radius is short and the falloff is
   * cubic, so the pool is a local smudge under the body rather than a warm
   * region the animal sits in the middle of.
   */
  groundHeat: {
    radiusMeters: 3.2,
    warmth: 0.26,
    // Displaces the pool boundary by the detail field, so its edge follows the
    // ground texture instead of drawing a circle.
    edgeBreakup: 0.3,
  },
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

/** Base warmth and stable per-instance variation for static surface props. */
export interface ThermalSurfaceWarmth {
  readonly vegetationWarmth: number;
  readonly vegetationWarmthSpread: number;
  readonly rockWarmth: number;
  readonly rockWarmthSpread: number;
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

  /**
   * Core body temperature of a living animal. It must stay above the
   * environment ceiling by enough that the whole body profile below it still
   * reads as alive; validation enforces the ceiling itself.
   */
  readonly actorWarmth: number;
}
