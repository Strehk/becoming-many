/**
 * Purpose: Define the fixed assets and placement capacity of Vegetation.
 * Context: Levels vary density while the available models and stable world pattern remain shared.
 * Responsibility: Keep model sources, zone variants, scale ranges, and the placement seed explicit.
 * Boundary: Level density lives in level presets; streaming and rendering live beside this file.
 */

import type { StaticPopulationDefinition } from "../static-population";

export const VEGETATION_DEFINITION: StaticPopulationDefinition = {
  seed: 341, // Keeps vegetation placement stable across levels.
  candidateSpacingMeters: 8, // Caps placement at 156.25 candidates per hectare.
  assets: [
    {
      id: "pine-1",
      url: "/trees/pine-single-01.glb",
      objectName: "Pine_4",
      minimumHeightMeters: 5,
      maximumHeightMeters: 9.5,
    },
    {
      id: "pine-2",
      url: "/trees/pine-single-02.glb",
      objectName: "Pine_5",
      minimumHeightMeters: 4.5,
      maximumHeightMeters: 8.5,
    },
    {
      id: "pine-3",
      url: "/trees/pine-trees-01.glb",
      objectName: "PineTree_5",
      minimumHeightMeters: 5,
      maximumHeightMeters: 9,
    },
    {
      id: "deciduous-tree-1",
      url: "/trees/trees.glb",
      objectName: "NormalTree_1",
      minimumHeightMeters: 5,
      maximumHeightMeters: 9.5,
    },
    {
      id: "deciduous-tree-2",
      url: "/trees/trees.glb",
      objectName: "NormalTree_2",
      minimumHeightMeters: 4.5,
      maximumHeightMeters: 8.5,
    },
    {
      id: "deciduous-tree-3",
      url: "/trees/trees.glb",
      objectName: "NormalTree_3",
      minimumHeightMeters: 6,
      maximumHeightMeters: 10,
    },
    {
      id: "bush",
      url: "/trees/bush.glb",
      objectName: "Bush_Common",
      minimumHeightMeters: 0.7,
      maximumHeightMeters: 1.3,
    },
    {
      id: "flowering-bush",
      url: "/trees/bush-with-flowers.glb",
      objectName: "Bush_Common_Flowers",
      minimumHeightMeters: 0.6,
      maximumHeightMeters: 1.2,
    },
  ],
  variantsByZone: {
    meadow: [
      { assetId: "deciduous-tree-1", weight: 1 },
      { assetId: "deciduous-tree-2", weight: 1 },
      { assetId: "deciduous-tree-3", weight: 1 },
      { assetId: "bush", weight: 7 },
    ],
    coniferForest: [
      { assetId: "pine-1", weight: 1 },
      { assetId: "pine-2", weight: 1 },
      { assetId: "pine-3", weight: 1 },
    ],
    deciduousForest: [
      { assetId: "deciduous-tree-1", weight: 1 },
      { assetId: "deciduous-tree-2", weight: 1 },
      { assetId: "deciduous-tree-3", weight: 1 },
    ],
    shrubSlope: [
      { assetId: "bush", weight: 4 },
      { assetId: "flowering-bush", weight: 1 },
    ],
  },
};
