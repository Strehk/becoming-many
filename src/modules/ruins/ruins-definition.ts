/**
 * Purpose: Define the ruined house and where the landscape is allowed to carry one.
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
    id: "house-ruin",
    url: "/ruins/house-ruin.glb",
    objectName: "house-ruin",
  },
  chunkLevel: 3,
  // Test value: three tries per cell finds a ruin often enough to judge the
  // placement while flying. One is what a landmark would offer.
  candidatesPerCell: 3,
  // The model is a collapsed house: walls standing to about half their height
  // with the roof down inside them. Six metres puts a flying visitor level
  // with the tallest wall, which is what makes it read as a building.
  heightMeters: { minimum: 5, maximum: 7 },
  footprintRadiusMeters: 9,
  // A temple standing on a slope reads as a prop dropped on the landscape.
  // Two metres across twenty-two is the fall a stepped platform can still
  // carry without looking like it slid.
  maximumGroundFallMeters: 2,
  zones: ["meadow"],
};
