/**
 * Purpose: Define the snake's body, its pace, and the ground that carries one.
 * Context: The authored model is a 57-metre tube of 57,600 triangles; this is its shape, rebuilt.
 * Responsibility: Keep the girth profile, sizes, speed, and placement demands explicit.
 * Boundary: Geometry, slither, and streaming live beside this file.
 */

import type { ZoneId } from "../../world-surface/zone-settings";

export interface SnakesDefinition {
  readonly seed: number;
  /** Candidates are drawn per cell of this level; 2 is the 64-metre cell. */
  readonly chunkLevel: 2;
  readonly lengthMeters: { readonly minimum: number; readonly maximum: number };
  /** Rings along the body and sides around it; the whole cost of one snake. */
  readonly ringCount: number;
  readonly sideCount: number;
  /**
   * Girth along the body, head first, as a fraction of the thickest point.
   * Read off the authored tube in forty slices and kept as the eleven that
   * describe it: a head, an even body, and a tail drawn to a point.
   */
  readonly girthProfile: readonly number[];
  /** Thickest radius, in metres, at the authored length. */
  readonly bodyRadiusMeters: number;
  readonly crawlSpeedMetersPerSecond: number;
  /** How far a snake crawls before it starts its way again. */
  readonly crawlDistanceMeters: number;
  /** Ground a snake crosses; the whole path must stay inside it. */
  readonly zones: readonly ZoneId[];
  /** How far the ground may fall along the path before a place is refused. */
  readonly maximumGroundFallMeters: number;
}

export const SNAKES_DEFINITION: SnakesDefinition = {
  seed: 8123, // Keeps snake placement stable across levels and runs.
  chunkLevel: 2,
  lengthMeters: { minimum: 1.1, maximum: 1.8 },
  // Eleven rings carry the wave without stepping, and six sides read as round
  // at the distance a flying visitor ever sees a snake from. Together they are
  // 120 triangles, against the 57,600 the authored tube shipped as.
  ringCount: 11,
  sideCount: 6,
  girthProfile: [0.55, 0.95, 1, 0.98, 0.97, 0.96, 0.94, 0.88, 0.74, 0.5, 0.12],
  bodyRadiusMeters: 0.045,
  // A grass snake covers its own length in about four seconds.
  crawlSpeedMetersPerSecond: 0.38,
  crawlDistanceMeters: 26,
  zones: ["meadow", "shrubSlope"],
  maximumGroundFallMeters: 3,
};
