/**
 * Purpose: Define the fixed assets and placement capacity of Rocks.
 * Context: Levels vary density while rock models and their stable world pattern remain shared.
 * Responsibility: Keep model sources, zone variants, scale ranges, and the placement seed explicit.
 * Boundary: Level density lives in level presets; streaming and rendering live beside this file.
 */

import type {
  StaticPopulationDefinition,
  WeightedStaticModel,
} from "../static-population";

const COMMON_ROCKS: readonly WeightedStaticModel[] = [
  { assetId: "rock-pack", weight: 1 },
  { assetId: "rock-medium", weight: 1 },
  { assetId: "rock-small", weight: 1 },
  { assetId: "gold-rock", weight: 0.1 },
];

export const ROCKS_DEFINITION: StaticPopulationDefinition = {
  seed: 719, // Keeps rock placement stable across levels.
  candidateSpacingMeters: 8, // Caps placement at 156.25 candidates per hectare.
  assets: [
    {
      id: "rock-pack",
      url: "/rocks/rocks-pack.glb",
      objectName: "Rock_2",
      minimumHeightMeters: 0.4,
      maximumHeightMeters: 1,
    },
    {
      id: "rock-medium",
      url: "/rocks/rock-medium.glb",
      objectName: "Rock_Medium_2",
      minimumHeightMeters: 0.5,
      maximumHeightMeters: 1.2,
    },
    {
      id: "rock-small",
      url: "/rocks/rocks.glb",
      objectName: "Rock_3",
      minimumHeightMeters: 0.25,
      maximumHeightMeters: 0.65,
    },
    {
      id: "gold-rock",
      url: "/rocks/gold-rocks.glb",
      objectName: "Resource_Gold_3",
      minimumHeightMeters: 0.3,
      maximumHeightMeters: 0.8,
    },
  ],
  variantsByZone: {
    meadow: COMMON_ROCKS,
    coniferForest: COMMON_ROCKS,
    deciduousForest: COMMON_ROCKS,
    shrubSlope: COMMON_ROCKS,
  },
};
