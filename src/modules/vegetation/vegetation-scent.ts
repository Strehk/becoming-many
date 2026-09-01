/**
 * Purpose: Expose Vegetation's deterministic placements as scent sources.
 * Context: Scent signatures belong to the plants themselves, not to free anchors.
 * Responsibility: Map every model onto a scent group and replay one chunk's plants.
 * Boundary: Rendering, assets, streaming, and lifecycle stay in the Vegetation module.
 */

import { createChunkCandidateGrid } from "../../world/chunk-candidates";
import { getChunkSize } from "../../world/chunk-system";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  PLANT_SCENT_GROUP_IDS,
  type PlantScentGroupId,
  type PlantScentSource,
} from "../scent-sources";
import {
  appendStaticPlacements,
  getStaticPlacementHeight,
  resolveStaticPopulation,
  type StaticPopulationPreset,
} from "../static-population";
import { VEGETATION_DEFINITION } from "./vegetation-definition";

const VEGETATION_CHUNK_LEVEL = 2;

/**
 * The rendered module additionally rejects instances whose scaled model
 * footprint touches the river channel; that radius needs the loaded asset,
 * which the Scent World does not load at all. This is the same conservative
 * stand-in the Connections anchors use, so scent and trees disagree only on
 * rare riverbank placements.
 */
const RIVER_FOOTPRINT_STAND_IN_METERS = 2.5;

/**
 * Which signature every model carries. Grouped by what a nose would plausibly
 * tell apart rather than by asset file: the seven conifer crowns are one
 * resin, the five round deciduous crowns one leaf, and the birches are split
 * off because they are the one living tree the level treats as its own
 * silhouette. Dead wood carries no leaf at all and therefore its own faint
 * signature.
 */
const SCENT_GROUP_BY_ASSET: Readonly<Record<string, PlantScentGroupId>> = {
  "pine-1": "conifer",
  "pine-2": "conifer",
  "pine-3": "conifer",
  "pine-4": "conifer",
  "pine-5": "conifer",
  "pine-6": "conifer",
  "pine-7": "conifer",
  "deciduous-tree-1": "deciduous",
  "deciduous-tree-2": "deciduous",
  "deciduous-tree-3": "deciduous",
  "deciduous-tree-4": "deciduous",
  "deciduous-tree-5": "deciduous",
  "birch-1": "birch",
  "birch-2": "birch",
  "birch-3": "birch",
  bush: "bush",
  "flowering-bush": "floweringBush",
  "dead-tree-1": "deadWood",
  "dead-tree-2": "deadWood",
};

/** Expose the level-authored tree and bush population as scent sources. */
export function createVegetationScentSource(
  preset: StaticPopulationPreset,
  worldSurface: WorldSurface,
): PlantScentSource {
  const parameters = resolveStaticPopulation(VEGETATION_DEFINITION, preset);
  const chunkSize = getChunkSize(VEGETATION_CHUNK_LEVEL);
  const candidateGrid = createChunkCandidateGrid(
    chunkSize,
    parameters.candidateSpacingMeters,
  );
  const groupIndexByAsset = createGroupIndexByAsset();

  return {
    groupIds: PLANT_SCENT_GROUP_IDS,

    // One candidate cell holds at most one plant, so the covered cells are
    // the exact bound. Requests smaller than a placement chunk cover fewer.
    maxPlantsPerChunk: (chunkSizeMeters) => {
      const chunkRatio = chunkSize / chunkSizeMeters;
      const cellsPerRequest = candidateGrid.cellsPerSide / chunkRatio;
      if (!Number.isInteger(chunkRatio) || !Number.isInteger(cellsPerRequest)) {
        throw new RangeError(
          "Scent requests must align with the vegetation placement grid",
        );
      }
      return cellsPerRequest ** 2;
    },

    appendChunkPlants: (chunkX, chunkZ, chunkSizeMeters, pushPlant) =>
      appendStaticPlacements(
        parameters,
        candidateGrid,
        worldSurface,
        chunkSize,
        { chunkX, chunkZ, chunkSizeMeters },
        (candidate) => {
          const { riverChannelMarginMeters } = worldSurface.zoneConditionsAt(
            candidate.worldX,
            candidate.worldZ,
          );
          return -riverChannelMarginMeters >= RIVER_FOOTPRINT_STAND_IN_METERS;
        },
        ({ candidate, model }, groundY) => {
          const groupIndex = groupIndexByAsset.get(model.id);
          if (groupIndex === undefined) return;
          pushPlant(
            candidate.worldX,
            groundY,
            candidate.worldZ,
            getStaticPlacementHeight(parameters.seed, model, candidate),
            groupIndex,
          );
        },
      ),
  };
}

/**
 * Resolve the mapping once and fail loudly on an unmapped model: a plant
 * added without a signature would otherwise silently stop smelling.
 */
function createGroupIndexByAsset(): ReadonlyMap<string, number> {
  const groupIndexByAsset = new Map<string, number>();

  for (const { id } of VEGETATION_DEFINITION.assets) {
    const groupId = SCENT_GROUP_BY_ASSET[id];
    if (!groupId) {
      throw new Error(`Vegetation asset has no scent group: ${id}`);
    }
    groupIndexByAsset.set(id, PLANT_SCENT_GROUP_IDS.indexOf(groupId));
  }

  return groupIndexByAsset;
}
