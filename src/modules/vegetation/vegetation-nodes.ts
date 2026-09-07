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
import {
  hasVegetationClearance,
  VEGETATION_DEFINITION,
} from "./vegetation-definition";

const VEGETATION_CHUNK_LEVEL = 2;

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
        (candidate) => hasVegetationClearance(worldSurface, candidate),
        pushAnchor,
      ),
  };
}
