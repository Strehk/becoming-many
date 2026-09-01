/**
 * Purpose: Keep the forest clearing anchors the Connections web links.
 * Context: Scent itself now radiates from plants and animals, not from free anchors.
 * Responsibility: Own the deterministic clearing search and its node source.
 * Boundary: Every scent particle lives in the fields beside this file, never here.
 */

import { getChunkSize } from "../../world/chunk-system";
import type { WorldSurface } from "../../world-surface/world-surface";
import type { ZoneId } from "../../world-surface/zone-settings";
import type { ConnectionNodeSource } from "../connection-nodes";
import {
  createScentRandomKey,
  getScentRandom,
  type ScentRandomKey,
} from "./scent-random";

/**
 * These were the scent emitters before scent moved onto the plants. They emit
 * nothing now; level 07 still links them, because they are the one node class
 * that sits in the open air of a wood rather than on a standing object, and
 * removing them would silently change the finished web. The values below are
 * the ones they were authored with and are deliberately frozen here.
 */
const CLEARING_CHUNK_LEVEL = 2;
const CLEARINGS_PER_CHUNK = 4;
const MINIMUM_HEIGHT_METERS = 0.7;
const MAXIMUM_HEIGHT_METERS = 1.3;
const PLACEMENT_ATTEMPTS = 4;
const SOURCE_ZONES: readonly ZoneId[] = ["coniferForest", "deciduousForest"];

/** Fixed random component indexes of one clearing. */
const CLEARING_RANDOM_HEIGHT = 2;
const CANDIDATE_RANDOM_FIRST = 8;

interface ClearingChunk {
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly originX: number;
  readonly originZ: number;
}

interface ClearingAnchor {
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
}

/** Expose the deterministic forest clearings as web anchors. */
export function createScentConnectionSource(
  groundYAt: WorldSurface["groundYAt"],
  zoneAt: WorldSurface["zoneAt"],
): ConnectionNodeSource {
  const clearingChunkSize = getChunkSize(CLEARING_CHUNK_LEVEL);

  return {
    sourceClass: "scentEmitters",
    appendChunkAnchors: (chunkX, chunkZ, chunkSizeMeters, pushAnchor) => {
      const chunkRatio = clearingChunkSize / chunkSizeMeters;
      if (!Number.isInteger(chunkRatio) || chunkRatio < 1) {
        throw new RangeError(
          "Anchor requests must align with the clearing chunk grid",
        );
      }
      const clearingChunkX = Math.floor(chunkX / chunkRatio);
      const clearingChunkZ = Math.floor(chunkZ / chunkRatio);
      const chunk: ClearingChunk = {
        chunkX: clearingChunkX,
        chunkZ: clearingChunkZ,
        originX: clearingChunkX * clearingChunkSize,
        originZ: clearingChunkZ * clearingChunkSize,
      };
      const minX = chunkX * chunkSizeMeters;
      const minZ = chunkZ * chunkSizeMeters;

      const search: ClearingSearch = {
        chunk,
        chunkSizeMeters: clearingChunkSize,
        groundYAt,
        zoneAt,
        randomKey: {
          ...createScentRandomKey(),
          chunkX: chunk.chunkX,
          chunkZ: chunk.chunkZ,
        },
      };

      // The requested sub-chunks of one clearing chunk partition its anchors.
      for (let index = 0; index < CLEARINGS_PER_CHUNK; index += 1) {
        const anchor = findClearingAnchor(search, index);
        if (!anchor) continue;
        if (anchor.worldX < minX || anchor.worldX >= minX + chunkSizeMeters) {
          continue;
        }
        if (anchor.worldZ < minZ || anchor.worldZ >= minZ + chunkSizeMeters) {
          continue;
        }
        pushAnchor(anchor.worldX, anchor.worldY, anchor.worldZ);
      }
    },
  };
}

interface ClearingSearch {
  readonly chunk: ClearingChunk;
  readonly chunkSizeMeters: number;
  readonly groundYAt: WorldSurface["groundYAt"];
  readonly zoneAt: WorldSurface["zoneAt"];

  /** Reused across the clearings of one chunk; -1 keeps the historical stream. */
  readonly randomKey: ScentRandomKey;
}

/**
 * Try a bounded number of deterministic candidate positions and keep the
 * first one inside a forest zone, anchored just above the ground.
 */
function findClearingAnchor(
  search: ClearingSearch,
  clearingIndex: number,
): ClearingAnchor | undefined {
  const { chunk, chunkSizeMeters, groundYAt, zoneAt, randomKey } = search;
  randomKey.sourceIndex = clearingIndex;

  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
    const componentBase = CANDIDATE_RANDOM_FIRST + attempt * 2;
    const worldX =
      chunk.originX +
      getScentRandom(randomKey, componentBase) * chunkSizeMeters;
    const worldZ =
      chunk.originZ +
      getScentRandom(randomKey, componentBase + 1) * chunkSizeMeters;
    if (!SOURCE_ZONES.includes(zoneAt(worldX, worldZ))) continue;

    const worldY =
      groundYAt(worldX, worldZ) +
      MINIMUM_HEIGHT_METERS +
      getScentRandom(randomKey, CLEARING_RANDOM_HEIGHT) *
        (MAXIMUM_HEIGHT_METERS - MINIMUM_HEIGHT_METERS);

    return { worldX, worldY, worldZ };
  }

  return undefined;
}
