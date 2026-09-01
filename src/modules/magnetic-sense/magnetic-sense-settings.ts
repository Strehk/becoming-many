/**
 * Purpose: Define the complete configuration of the Magnetic Sense sky.
 * Context: The look is the previous version's saved sky, hardcoded instead of live-tunable.
 * Responsibility: Keep the public parameter contract and the ported tuning values discoverable.
 * Boundary: Shader source, uniforms, validation, and scene ownership stay elsewhere.
 */

export const MAGNETIC_SENSE_SETTINGS = {
  // Long enough that a run never reaches it, short enough to keep the noise
  // input inside float precision. The drift is linear, so the wrap is a visible
  // step — it must stay far outside the length of a show.
  animationLoopSeconds: 3600,

  /**
   * The radical-pair shimmer, ported verbatim from the previous version's
   * saved sky state (`src/senses/state.json`, module `magnetfeld`, mode
   * `birdspec` at weight 1). That build exposed every value as a live
   * dev-console slider; here the finished look is hardcoded and only the
   * field axis, the palette, and the sense strength stay level-authored.
   */
  shimmer: {
    /** Grain frequency of the radical-pair pattern. */
    grainFrequency: 30,
    /** Pattern strength away from the poles; zero leaves the open sky quiet. */
    baseAmount: 0,
    /** Added strength inside the pole zones. */
    poleAmount: 2.85,
    /** Pole-zone falloff exponent; 20 keeps the shimmer a tight patch. */
    poleWidthExponent: 20,
    contrast: 1,
    /** Iridescent overlay strength inside the pole zones. */
    iridescence: 0.7,
    /** Slow breathing of the pole zone, one cycle every four pi seconds. */
    breathe: 1,
    /** Noise drift heading in degrees from north, its tempo, and its vertical part. */
    driftHeadingDegrees: 60,
    driftSpeed: 0.4,
    driftVertical: 0.25,
    /** Anisotropy along the field axis; 1 leaves the grain isotropic. */
    stretch: 1,
    /**
     * Grain color on the ring between the poles. The previous version carried
     * it as a linear literal; the sRGB hex here converts to the same value.
     */
    neutralColor: 0xb3b6c4,
  },

  // The camera-following dome the whole sense lives on.
  sky: {
    // Inside the narrative 128 m far plane and the diagnostic 180 m one.
    domeRadiusMeters: 120,
    // Modest segments; the sky is fragment-analytic and the mesh is never lit.
    widthSegments: 32,
    heightSegments: 16,
  },
} as const;

/** Preset-authored palette of the ported sky. */
export interface MagneticSenseColors {
  /** Grain color at the magnetic north point. */
  readonly northColor: number;
  /** Grain color at the southern counter-pole. */
  readonly southColor: number;
  /** Sky color at the zenith; the horizon carries the level haze. */
  readonly zenithColor: number;
}

/** Level-authored strength, field axis, and palette. */
export interface MagneticSenseParameters {
  /** Sense strength 0..1; the composition root skips the sense at zero. */
  readonly intensity: number;
  readonly fieldDirectionDegreesFromNorth: number;
  /** Inclination of the field axis above the horizon, as the previous version authored it. */
  readonly fieldElevationDegrees: number;
  readonly colors: MagneticSenseColors;
}
