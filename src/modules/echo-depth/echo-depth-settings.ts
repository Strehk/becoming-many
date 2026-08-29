/**
 * Purpose: Define the complete configuration of the Echo Depth effect.
 * Context: Levels author distances, palette, and rim while the module owns the ramp shape.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Shader injection, uniforms, validation, and material ownership stay elsewhere.
 */

export const ECHO_DEPTH_SETTINGS = {
  // Normalized 0..1 ramp positions between the near and far distances.
  // Each value marks where its palette color is fully reached; raising a
  // value pushes that color band further away from the viewer.
  nearShadeStopFraction: 0.2,
  midStopFraction: 0.5,
  farStopFraction: 0.8,
} as const;

/** The five ramp colors from viewer to horizon. */
export interface EchoDepthColors {
  readonly nearColor: number;
  readonly nearShadeColor: number;
  readonly midColor: number;
  readonly farColor: number;

  /** Should match the level background so distant geometry dissolves. */
  readonly hazeColor: number;
}

/** Level-authored strength, distance mapping, and palette values. */
export interface EchoDepthParameters {
  /** Sense strength 0..1; the composition root skips the effect at zero. */
  readonly intensity: number;

  /** Distances bounding the depth ramp; nearer stays solid, farther stays haze. */
  readonly nearDistanceMeters: number;
  readonly farDistanceMeters: number;
  readonly colors: EchoDepthColors;

  /**
   * The one exception to the ramp: where the river holds water, Terrain shows
   * this tone instead of its depth color, and it fades into the haze over the
   * same last ramp segment as every other surface. Omitting it leaves the
   * river as the carved shape the ramp already draws, and costs nothing — the
   * per-vertex water measure is streamed only when a level authors a color.
   *
   * Terrain alone can show it. Vegetation, Rocks, and Grass carry no water.
   */
  readonly waterColor?: number;
}
