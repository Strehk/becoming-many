/**
 * Purpose: Define the complete configuration of the Magnetic Sense effect.
 * Context: Levels author field direction, line dimensions, and palette while the module owns tuning.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Shader injection, uniforms, validation, and scene ownership stay elsewhere.
 */

export const MAGNETIC_SENSE_SETTINGS = {
  // Wraps the shared time uniform so the flow phase never loses float precision.
  animationLoopSeconds: 60,

  // The camera-following horizon-glow dome.
  sky: {
    // Inside the narrative 128 m far plane and the diagnostic 180 m one.
    domeRadiusMeters: 120,
    // Modest segments; the glow is fragment-analytic, the mesh is never lit.
    widthSegments: 32,
    heightSegments: 16,
    // Glow reaches this view-direction elevation before dissolving into haze.
    glowElevationSpan: 0.35,
    // Soft glow start below the horizon so terrain gaps stay coherent.
    belowHorizonElevation: -0.12,
    // Azimuthal lobe exponent; 2 gives a wide soft glow centred on the field.
    glowAzimuthExponent: 2,
  },
} as const;

/** Preset-authored moodboard colors for the ground lines and the sky cue. */
export interface MagneticSenseColors {
  readonly lineColor: number;
  readonly pulseColor: number;
  readonly skyGlowColor: number;
}

/** Level-authored strength, field direction, line dimensions, and palette. */
export interface MagneticSenseParameters {
  /** Sense strength 0..1; the composition root skips the sense at zero. */
  readonly intensity: number;
  readonly fieldDirectionDegreesFromNorth: number;
  readonly lineSpacingMeters: number;
  readonly lineWidthMeters: number;
  readonly pulseWidthMeters: number;
  readonly lineOpacity: number;
  readonly flowSpeedMetersPerSecond: number;
  readonly colors: MagneticSenseColors;
}
