/**
 * Purpose: Define the authored rules that divide the continuous world into zones.
 * Context: Zone placement must stay independent from rendering, chunks, and level presentation.
 * Responsibility: Keep zone identities and classification thresholds in one editable place.
 * Boundary: Terrain shape lives in surface-settings; colors and textures live in modules.
 */

export const ZONE_SETTINGS = {
  featureSizeMeters: 112, // Larger values create larger connected forest and meadow regions.
  coniferForestThreshold: -0.25, // Lower region values become conifer forest.
  deciduousForestThreshold: 0.28, // Higher region values become deciduous forest.
  shrubSlopeThreshold: 0.27, // Ground at or above this slope becomes shrub-covered terrain.
};

export type ZoneSettings = typeof ZONE_SETTINGS;

export type ZoneId =
  | "water"
  | "meadow"
  | "coniferForest"
  | "deciduousForest"
  | "shrubSlope";
