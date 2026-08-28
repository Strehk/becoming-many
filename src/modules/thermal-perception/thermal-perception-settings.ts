/**
 * Purpose: Define the complete configuration of the Thermal Perception effect.
 * Context: Levels author radius, palette, and warmth targets while the module owns the ramp shape.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Shader injection, uniforms, validation, and material ownership stay elsewhere.
 */

export const THERMAL_PERCEPTION_SETTINGS = {
  // Normalized 0..1 ramp positions across the warmth value. Each value marks
  // where its palette color is fully reached; raising a value pushes that
  // color band toward warmer surfaces.
  coldStopFraction: 0.2,
  coolStopFraction: 0.4,
  warmStopFraction: 0.6,
  hotStopFraction: 0.8,

  // Terrain warmth mapping from elevation and zone conditions.
  terrainWarmth: {
    // Warmth right at the waterline; deeper water reads colder from here.
    shorelineWarmth: 0.12,
    waterColdPerDepthMeter: 0.06,
    // Dry ground spans floor..floor+span across the reachable elevation range.
    landWarmthFloor: 0.2,
    landElevationWarmthSpan: 0.5,
    // Forest regions and steep faces hold extra warmth on top of elevation.
    forestWarmthBoost: 0.12,
    slopeWarmthBoost: 0.1,
  },

  // Instance world positions are quantized to this cell before hashing so all
  // parts of one plant or rock agree on a single stable warmth variation.
  instanceHashCellMeters: 2,
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

  /** Constant warmth of living animals; near the hottest palette bands. */
  readonly actorWarmth: number;
}
