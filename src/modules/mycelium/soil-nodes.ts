/**
 * Purpose: Seed the deterministic underground points the root mat is woven from.
 * Context: World anchors alone leave the web as sparse as the content happens to be.
 * Responsibility: Place per-chunk soil points under the surface at the authored density.
 * Boundary: Topology, streaming, and rendering stay elsewhere; this only places points.
 */

import type { WorldSurface } from "../../world-surface/world-surface";
import type {
  ConnectionNodeSource,
  PushConnectionAnchor,
} from "../connection-nodes";
import { MYCELIUM_SETTINGS } from "./mycelium-settings";

const RANDOM_VALUE_RANGE = 0x1_0000_0000;

/** Value indices keeping one point's draws independent of each other. */
const EASTING_VALUE = 0;
const NORTHING_VALUE = 1;
const DEPTH_VALUE = 2;

/**
 * The mat the world anchors hang in. Every point is a pure function of its
 * chunk and its index inside that chunk, so a window recentring on the same
 * ground rebuilds the identical topology and the web does not swim while the
 * visitor walks.
 */
export function createSoilNodeSource(
  worldSurface: WorldSurface,
): ConnectionNodeSource {
  return {
    sourceClass: "soil",
    appendChunkAnchors: (chunkX, chunkZ, chunkSizeMeters, pushAnchor) => {
      appendSoilAnchors(
        worldSurface,
        chunkX,
        chunkZ,
        chunkSizeMeters,
        pushAnchor,
      );
    },
  };
}

/** How many points one chunk of the given size carries at the authored density. */
export function getSoilNodesPerChunk(chunkSizeMeters: number): number {
  return Math.round(
    chunkSizeMeters *
      chunkSizeMeters *
      MYCELIUM_SETTINGS.soilNodesPerSquareMeter,
  );
}

function appendSoilAnchors(
  worldSurface: WorldSurface,
  chunkX: number,
  chunkZ: number,
  chunkSizeMeters: number,
  pushAnchor: PushConnectionAnchor,
): void {
  const { soilMinimumDepthMeters, soilDepthSpanMeters, soilDepthBias } =
    MYCELIUM_SETTINGS;
  const originX = chunkX * chunkSizeMeters;
  const originZ = chunkZ * chunkSizeMeters;
  const pointCount = getSoilNodesPerChunk(chunkSizeMeters);

  for (let point = 0; point < pointCount; point += 1) {
    const worldX =
      originX +
      getSoilRandom(chunkX, chunkZ, point, EASTING_VALUE) * chunkSizeMeters;
    const worldZ =
      originZ +
      getSoilRandom(chunkX, chunkZ, point, NORTHING_VALUE) * chunkSizeMeters;
    // Biased toward the surface: most of a root mat sits in the top soil and
    // only single strands reach the bottom of the profile.
    const depth =
      soilMinimumDepthMeters +
      getSoilRandom(chunkX, chunkZ, point, DEPTH_VALUE) ** soilDepthBias *
        soilDepthSpanMeters;
    pushAnchor(worldX, worldSurface.groundYAt(worldX, worldZ) - depth, worldZ);
  }
}

/** Deterministic 0..1 draw for one point's one value, as the grass field hashes cells. */
function getSoilRandom(
  chunkX: number,
  chunkZ: number,
  pointIndex: number,
  valueIndex: number,
): number {
  let hash = Math.imul(chunkX, 73_856_093);
  hash ^= Math.imul(chunkZ, 19_349_663);
  hash ^= Math.imul(pointIndex + 1, 83_492_791);
  hash ^= Math.imul(valueIndex + 1, 2_971_215_073);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);
  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}
