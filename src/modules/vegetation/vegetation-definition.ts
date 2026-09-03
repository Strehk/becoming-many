/**
 * Purpose: Define the fixed assets and placement capacity of Vegetation.
 * Context: Levels vary density while the available models and stable world pattern remain shared.
 * Responsibility: Keep model sources, zone variants, scale ranges, and the placement seed explicit.
 * Boundary: Level density lives in level presets; streaming and rendering live beside this file.
 */

import type { StaticPopulationDefinition } from "../static-population";

/**
 * What a plant is, told apart by stature rather than by species: a plant that
 * carries a canopy above a stem, and a plant that is all low body. It is the
 * one distinction a sense can make without knowing the asset list, and senses
 * that treat a plant as a body of substance need it — a bush is too small to
 * carry a gradient a ten-metre pine carries easily.
 */
export type VegetationStature = "canopy" | "undergrowth";

/** The models that are undergrowth; everything else carries a canopy. */
const UNDERGROWTH_ASSET_IDS: ReadonlySet<string> = new Set([
  "bush",
  "flowering-bush",
]);

export function getVegetationStature(assetId: string): VegetationStature {
  return UNDERGROWTH_ASSET_IDS.has(assetId) ? "undergrowth" : "canopy";
}

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
    // Everything below is appended rather than interleaved: the leaf and
    // accent colors alternate by array index, so inserting into the middle
    // would silently repaint the plants above.
    // The four remaining crowns inside pine-trees-01.glb. That file is
    // already downloaded for PineTree_5, so these cost no transfer and no
    // extra source: they are silhouettes that were loaded and then left
    // unused. Seven conifer outlines instead of three is the cheapest answer
    // there is to a stand reading as one shape repeated.
    {
      id: "pine-4",
      url: "/trees/pine-trees-01.glb",
      objectName: "PineTree_1",
      minimumHeightMeters: 5,
      maximumHeightMeters: 9.5,
    },
    {
      id: "pine-5",
      url: "/trees/pine-trees-01.glb",
      objectName: "PineTree_2",
      minimumHeightMeters: 4,
      maximumHeightMeters: 8,
    },
    {
      id: "pine-6",
      url: "/trees/pine-trees-01.glb",
      objectName: "PineTree_3",
      minimumHeightMeters: 5.5,
      maximumHeightMeters: 10,
    },
    {
      id: "pine-7",
      url: "/trees/pine-trees-01.glb",
      objectName: "PineTree_4",
      minimumHeightMeters: 4.5,
      maximumHeightMeters: 8.5,
    },
    // The two remaining crowns inside trees.glb, unused on the same terms.
    {
      id: "deciduous-tree-4",
      url: "/trees/trees.glb",
      objectName: "NormalTree_4",
      minimumHeightMeters: 5,
      maximumHeightMeters: 9,
    },
    {
      id: "deciduous-tree-5",
      url: "/trees/trees.glb",
      objectName: "NormalTree_5",
      minimumHeightMeters: 4,
      maximumHeightMeters: 8,
    },
    // Birch is the one new file, and it is here for its outline rather than
    // for the species: a tall, narrow, open crown on a slender trunk is the
    // furthest thing in the set from the faceted ball the other deciduous
    // trees are, so a wood holding both stops reading as one silhouette at
    // two sizes. Its heights run taller and thinner than the trees around it
    // for the same reason. It also carries fewer triangles per instance than
    // the trees it displaces, so the mix costs nothing on the frame; what it
    // costs is transfer, and that is recorded in docs/assets/trees.md.
    {
      id: "birch-1",
      url: "/trees/birch-trees.glb",
      objectName: "BirchTree_1",
      minimumHeightMeters: 6.5,
      maximumHeightMeters: 11,
    },
    {
      id: "birch-2",
      url: "/trees/birch-trees.glb",
      objectName: "BirchTree_2",
      minimumHeightMeters: 6,
      maximumHeightMeters: 10.5,
    },
    {
      id: "birch-3",
      url: "/trees/birch-trees.glb",
      objectName: "BirchTree_3",
      minimumHeightMeters: 7,
      maximumHeightMeters: 12,
    },
    // Standing dead wood: bare branching, no crown at all, and therefore the
    // only thing in the set with an outline that is not a solid. It carries
    // just the trunk material, so it takes the trunk color and never the leaf
    // colors. It is weighted as a small minority everywhere it appears —
    // enough to break a horizon of repeated crowns, not enough to make the
    // forest read as a dying one, which would be a content decision this file
    // has no standing to make.
    {
      id: "dead-tree-1",
      url: "/trees/dead-trees.glb",
      objectName: "DeadTree_6",
      minimumHeightMeters: 4,
      maximumHeightMeters: 8,
    },
    {
      id: "dead-tree-2",
      url: "/trees/dead-trees.glb",
      objectName: "DeadTree_7",
      minimumHeightMeters: 3.5,
      maximumHeightMeters: 7,
    },
  ],
  // Weights are shares within a zone, never densities: how many plants stand
  // in a hectare is authored by the level and is untouched here. Only which
  // shapes fill that count changes.
  variantsByZone: {
    // The six tree entries carry half a weight each, so trees still total 3
    // against the bushes' 7 and the meadow stays exactly as open as it was.
    // What changes is that those three trees per ten plants are now drawn
    // from six outlines instead of three.
    meadow: [
      { assetId: "deciduous-tree-1", weight: 0.5 },
      { assetId: "deciduous-tree-2", weight: 0.5 },
      { assetId: "deciduous-tree-3", weight: 0.5 },
      { assetId: "deciduous-tree-4", weight: 0.5 },
      { assetId: "deciduous-tree-5", weight: 0.5 },
      { assetId: "birch-1", weight: 0.5 },
      { assetId: "bush", weight: 7 },
    ],
    // Seven conifer crowns in even shares, plus a small standing-dead share:
    // about one plant in fifteen here is bare branching rather than a cone,
    // which is what puts an irregular outline into a horizon that otherwise
    // repeats the same one.
    coniferForest: [
      { assetId: "pine-1", weight: 1 },
      { assetId: "pine-2", weight: 1 },
      { assetId: "pine-3", weight: 1 },
      { assetId: "pine-4", weight: 1 },
      { assetId: "pine-5", weight: 1 },
      { assetId: "pine-6", weight: 1 },
      // PineTree_4 is the one model in the pack that is not an upright cone:
      // its trunk drifts more than two units sideways over its own height and
      // carries a nearly horizontal limb, so a full share of it put visibly
      // crooked trees through the whole wood. Kept at a fifteenth of a share,
      // it is the rare leaning tree a forest has rather than a defect.
      { assetId: "pine-7", weight: 0.15 },
      { assetId: "dead-tree-1", weight: 0.5 },
    ],
    // Five round crowns against three birches: roughly a third of the wood
    // is now tall and narrow, which is the largest silhouette contrast the
    // asset set can produce between two living deciduous trees.
    deciduousForest: [
      { assetId: "deciduous-tree-1", weight: 1 },
      { assetId: "deciduous-tree-2", weight: 1 },
      { assetId: "deciduous-tree-3", weight: 1 },
      { assetId: "deciduous-tree-4", weight: 1 },
      { assetId: "deciduous-tree-5", weight: 1 },
      { assetId: "birch-1", weight: 1 },
      { assetId: "birch-2", weight: 1 },
      { assetId: "birch-3", weight: 1 },
      { assetId: "dead-tree-2", weight: 0.5 },
    ],
    // The slope held nothing but round bushes, so every silhouette on it was
    // the same convex blob. One plant in eighteen is now standing dead wood,
    // rising well above the scrub around it.
    shrubSlope: [
      { assetId: "bush", weight: 4 },
      { assetId: "flowering-bush", weight: 1 },
      { assetId: "dead-tree-1", weight: 0.3 },
    ],
  },
};
