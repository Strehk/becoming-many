/**
 * Purpose: Define the ruin model and where the landscape is allowed to carry one.
 * Context: A ruin is a landmark, not a scatter: one candidate per cell, most refused.
 * Responsibility: Keep the asset, its size, its ground demands, and the seed explicit.
 * Boundary: Streaming, placement, and rendering live beside this file.
 */

import type { ZoneId } from "../../world-surface/zone-settings";

export interface RuinsDefinition {
  readonly seed: number;
  readonly asset: {
    readonly id: string;
    readonly url: string;
    readonly objectName: string;
  };
  /** Candidates are drawn per cell of this level; 3 is the 128-metre cell. */
  readonly chunkLevel: 3;
  /**
   * How many places one cell offers. The ground refuses most of them, so this
   * is the coarse knob on how much temple a landscape holds and the preset's
   * standing share is the fine one.
   */
  readonly candidatesPerCell: number;
  /** Standing height in metres, drawn per candidate. */
  readonly heightMeters: { readonly minimum: number; readonly maximum: number };
  /** Metres from the centre the ground is read for slope and zone. */
  readonly footprintRadiusMeters: number;
  /** How far the ground under the footprint may fall before a cell is refused. */
  readonly maximumGroundFallMeters: number;
  /** Ground a ruin may stand in; every corner of the footprint must match. */
  readonly zones: readonly ZoneId[];
}

export const RUINS_DEFINITION: RuinsDefinition = {
  seed: 4441, // Keeps ruin placement stable across levels and runs.
  asset: {
    id: "temple-ruin",
    url: "/ruins/temple-ruin.glb",
    objectName: "temple-ruin",
  },
  chunkLevel: 3,
  // Test value: three tries per cell finds a ruin often enough to judge the
  // placement while flying. One is what a landmark would offer.
  candidatesPerCell: 3,
  // The model is a colonnade on a platform: at seven metres a visitor flies
  // level with its roof, which is what makes it read as a building rather
  // than as a rock formation.
  heightMeters: { minimum: 6.5, maximum: 9 },
  footprintRadiusMeters: 11,
  // A temple standing on a slope reads as a prop dropped on the landscape.
  // Two metres across twenty-two is the fall a stepped platform can still
  // carry without looking like it slid.
  maximumGroundFallMeters: 2,
  zones: ["meadow"],
};
