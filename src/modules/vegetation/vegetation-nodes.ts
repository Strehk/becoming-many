/**
 * Purpose: Expose Vegetation's deterministic placements as Connections web anchors.
 * Context: The Connections level links trees and bushes to the wider world.
 * Responsibility: Replay the accepted candidates of one requested chunk as anchors.
 * Boundary: Rendering, assets, streaming, and lifecycle stay in the Vegetation module.
 */

import { createChunkCandidateGrid } from "../../world/chunk-candidates";
import { getChunkSize } from "../../world/chunk-system";
import type { WorldSurface } from "../../world-surface/world-surface";
import type { ConnectionNodeSource } from "../connection-nodes";
import {
  appendStaticPlacementAnchors,
  resolveStaticPopulation,
  type StaticPopulationPreset,
} from "../static-population";
import { VEGETATION_DEFINITION } from "./vegetation-definition";

const VEGETATION_CHUNK_LEVEL = 2;

/**
 * The rendered module additionally rejects instances whose scaled model
 * footprint touches the river channel; that radius needs the loaded asset,
 * unavailable here. This fixed conservative stand-in keeps anchors and trees
 * matching everywhere except rare riverbank placements, which is documented
 * rather than hidden.
 */
const RIVER_FOOTPRINT_STAND_IN_METERS = 2.5;

/** Expose the level-authored tree and bush positions as web anchors. */
export function createVegetationConnectionSource(
  preset: StaticPopulationPreset,
  worldSurface: WorldSurface,
): ConnectionNodeSource {
  const parameters = resolveStaticPopulation(VEGETATION_DEFINITION, preset);
  const chunkSize = getChunkSize(VEGETATION_CHUNK_LEVEL);
  const candidateGrid = createChunkCandidateGrid(
    chunkSize,
    parameters.candidateSpacingMeters,
  );

  return {
    sourceClass: "vegetation",
    appendChunkAnchors: (chunkX, chunkZ, chunkSizeMeters, pushAnchor) =>
      appendStaticPlacementAnchors(
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
        pushAnchor,
      ),
  };
}
