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
  /**
   * How readily each ground carries a snake, as a weight between zero and
   * one. Zero refuses it outright; the whole path must stay on ground that
   * carries some weight. Weights rather than a plain list, because where a
   * snake *belongs* and where a crossing can be *seen* are not the same
   * place, and the piece needs both to be true at once.
   */
  readonly zoneWeights: Partial<Record<ZoneId, number>>;
  /** How far the ground may fall along the path before a place is refused. */
  readonly maximumGroundFallMeters: number;
}

export const SNAKES_DEFINITION: SnakesDefinition = {
  seed: 8123, // Keeps snake placement stable across levels and runs.
  chunkLevel: 2,
  // A large snake, and no larger: what makes one findable from the air is the
  // heat it carries, not the size it is blown up to.
  lengthMeters: { minimum: 1.6, maximum: 2.4 },
  // Eleven rings carry the wave without stepping, and six sides read as round
  // at the distance a flying visitor ever sees a snake from. Together they are
  // 120 triangles, against the 57,600 the authored tube shipped as.
  ringCount: 11,
  sideCount: 6,
  girthProfile: [0.55, 0.95, 1, 0.98, 0.97, 0.96, 0.94, 0.88, 0.74, 0.5, 0.12],
  bodyRadiusMeters: 0.085,
  // Its own length in about four seconds, as a snake moves.
  crawlSpeedMetersPerSecond: 0.52,
  // Short enough that a snake stays in the square it was offered: a long way
  // let two of them crawl into each other from opposite squares.
  crawlDistanceMeters: 13,
  /*
   * Every ground but water, weighted by what a crossing reads on. The meadow
   * is where a snake belongs and the one place it cannot be seen: grass
   * covers it completely and stands three metres tall, so it keeps a snake
   * without ever showing one. The wood carries no grass but a canopy over it,
   * which leaves a body readable from below and at the treeline. The open
   * slope carries only half the grass and no canopy at all, and is the one
   * ground a snake is met on from the air — so it carries most of them.
   */
  zoneWeights: {
    meadow: 0.18,
    coniferForest: 0.55,
    deciduousForest: 0.55,
    shrubSlope: 1,
  },
  maximumGroundFallMeters: 3,
};
