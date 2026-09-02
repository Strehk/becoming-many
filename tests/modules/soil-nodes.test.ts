/**
 * Purpose: Verify the seeded soil points the Connections mat is woven from.
 * Context: A window recentring on the same ground must rebuild the identical mat.
 * Responsibility: Cover determinism, chunk containment, depth bounds, and density.
 * Boundary: Topology, streaming, and rendering are covered by the Mycelium tests.
 */

import { expect, test } from "bun:test";
import { MYCELIUM_SETTINGS } from "../../src/modules/mycelium/mycelium-settings";
import {
  createSoilNodeSource,
  getSoilNodesPerChunk,
} from "../../src/modules/mycelium/soil-nodes";
import { BASE_CHUNK_SIZE } from "../../src/world/chunk-system";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

const WORLD_SURFACE = createWorldSurface(WORLD_SURFACE_SETTINGS, ZONE_SETTINGS);
const SOURCE = createSoilNodeSource(WORLD_SURFACE);

function collectChunk(chunkX: number, chunkZ: number): number[] {
  const anchors: number[] = [];
  SOURCE.appendChunkAnchors(chunkX, chunkZ, BASE_CHUNK_SIZE, (x, y, z) => {
    anchors.push(x, y, z);
  });
  return anchors;
}

test("Soil points are the mat's own class, not another module's content", () => {
  expect(SOURCE.sourceClass).toBe("soil");
});

test("Soil points repeat exactly for the same chunk", () => {
  expect(collectChunk(3, -7)).toEqual(collectChunk(3, -7));
});

test("Soil points differ between chunks", () => {
  expect(collectChunk(3, -7)).not.toEqual(collectChunk(4, -7));
  expect(collectChunk(3, -7)).not.toEqual(collectChunk(3, -6));
});

test("Soil points fill their chunk at the authored density", () => {
  const anchors = collectChunk(0, 0);
  expect(anchors).toHaveLength(getSoilNodesPerChunk(BASE_CHUNK_SIZE) * 3);
  // The window is sized against this rate; drifting from it silently
  // overruns or starves the node pool.
  expect(getSoilNodesPerChunk(BASE_CHUNK_SIZE)).toBe(
    BASE_CHUNK_SIZE ** 2 * MYCELIUM_SETTINGS.soilNodesPerSquareMeter,
  );
});

test("Soil points stay inside the chunk that generated them", () => {
  const chunkX = -2;
  const chunkZ = 5;
  const anchors = collectChunk(chunkX, chunkZ);

  for (let point = 0; point < anchors.length; point += 3) {
    const x = anchors[point] ?? 0;
    const z = anchors[point + 2] ?? 0;
    expect(x).toBeGreaterThanOrEqual(chunkX * BASE_CHUNK_SIZE);
    expect(x).toBeLessThan((chunkX + 1) * BASE_CHUNK_SIZE);
    expect(z).toBeGreaterThanOrEqual(chunkZ * BASE_CHUNK_SIZE);
    expect(z).toBeLessThan((chunkZ + 1) * BASE_CHUNK_SIZE);
  }
});

test("Soil points hang below their own ground within the authored profile", () => {
  const anchors = collectChunk(1, 1);
  const { soilMinimumDepthMeters, soilDepthSpanMeters } = MYCELIUM_SETTINGS;
  let shallowCount = 0;

  for (let point = 0; point < anchors.length; point += 3) {
    const x = anchors[point] ?? 0;
    const y = anchors[point + 1] ?? 0;
    const z = anchors[point + 2] ?? 0;
    const depth = WORLD_SURFACE.groundYAt(x, z) - y;
    expect(depth).toBeGreaterThanOrEqual(soilMinimumDepthMeters);
    expect(depth).toBeLessThanOrEqual(
      soilMinimumDepthMeters + soilDepthSpanMeters,
    );
    if (depth < soilMinimumDepthMeters + soilDepthSpanMeters / 2) {
      shallowCount += 1;
    }
  }

  // Biased toward the surface: a root mat thins with depth rather than
  // filling a slab, so most points sit in the upper half of the profile.
  expect(shallowCount / (anchors.length / 3)).toBeGreaterThan(0.6);
});
