/**
 * Purpose: Expose Rocks' deterministic placements as Connections web anchors.
 * Context: The Connections level links rocks into the web as passive nodes.
 * Responsibility: Replay the accepted candidates of one requested chunk as anchors.
 * Boundary: Rendering, assets, streaming, and lifecycle stay in the Rocks module.
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
import { ROCKS_DEFINITION } from "./rocks-definition";

const ROCK_CHUNK_LEVEL = 2;

/** Expose the level-authored rock positions as web anchors. */
export function createRockConnectionSource(
  preset: StaticPopulationPreset,
  worldSurface: WorldSurface,
): ConnectionNodeSource {
  const parameters = resolveStaticPopulation(ROCKS_DEFINITION, preset);
  const chunkSize = getChunkSize(ROCK_CHUNK_LEVEL);
  const candidateGrid = createChunkCandidateGrid(
    chunkSize,
    parameters.candidateSpacingMeters,
  );

  return {
    sourceClass: "rocks",
    appendChunkAnchors: (chunkX, chunkZ, chunkSizeMeters, pushAnchor) =>
      appendStaticPlacementAnchors(
        parameters,
        candidateGrid,
        worldSurface,
        chunkSize,
        { chunkX, chunkZ, chunkSizeMeters },
        () => true,
        pushAnchor,
      ),
  };
}
