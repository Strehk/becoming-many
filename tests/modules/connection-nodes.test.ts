/**
 * Purpose: Verify the deterministic anchor sources feeding the Connections web.
 * Context: Web nodes must sit exactly where the source modules place their content.
 * Responsibility: Cover determinism, chunk bounds, partitioning, and field equivalence.
 * Boundary: Topology, GPU pools, and module lifecycle are covered by their own tests.
 */

import { expect, test } from "bun:test";
import type { ConnectionNodeSource } from "../../src/modules/connection-nodes";
import { createRockConnectionSource } from "../../src/modules/rocks/rock-nodes";
import { createScentConnectionSource } from "../../src/modules/scent-particles/scent-emitter-anchors";
import { createVegetationConnectionSource } from "../../src/modules/vegetation/vegetation-nodes";
import { createVegetationScentSource } from "../../src/modules/vegetation/vegetation-scent";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

const WORLD_SURFACE = createWorldSurface(WORLD_SURFACE_SETTINGS, ZONE_SETTINGS);
const REQUEST_CHUNK_SIZE = 32;
/** The frozen clearing values level 07 links; they are module-owned now. */
const CLEARING_MINIMUM_HEIGHT_METERS = 0.7;
const CLEARING_MAXIMUM_HEIGHT_METERS = 1.3;
const DENSITY_PRESET = {
  instancesPerHectareByZone: {
    meadow: 12,
    coniferForest: 150,
    deciduousForest: 150,
    shrubSlope: 70,
  },
};

interface Anchor {
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
}

function collectAnchors(
  source: ConnectionNodeSource,
  chunkX: number,
  chunkZ: number,
  chunkSizeMeters: number,
): Anchor[] {
  const anchors: Anchor[] = [];
  source.appendChunkAnchors(chunkX, chunkZ, chunkSizeMeters, (x, y, z) =>
    anchors.push({ worldX: x, worldY: y, worldZ: z }),
  );
  return anchors;
}

function anchorKeys(anchors: readonly Anchor[]): string[] {
  return anchors
    .map(
      (anchor) =>
        `${anchor.worldX.toFixed(4)}:${anchor.worldY.toFixed(4)}:${anchor.worldZ.toFixed(4)}`,
    )
    .sort();
}

function collectWindowAnchors(
  source: ConnectionNodeSource,
  chunkRange: number,
): Anchor[] {
  const anchors: Anchor[] = [];
  for (let chunkX = -chunkRange; chunkX <= chunkRange; chunkX += 1) {
    for (let chunkZ = -chunkRange; chunkZ <= chunkRange; chunkZ += 1) {
      anchors.push(
        ...collectAnchors(source, chunkX, chunkZ, REQUEST_CHUNK_SIZE),
      );
    }
  }
  return anchors;
}

test("Vegetation anchors are deterministic and stay inside their chunk", () => {
  const source = createVegetationConnectionSource(
    DENSITY_PRESET,
    WORLD_SURFACE,
  );
  const anchors = collectWindowAnchors(source, 4);
  expect(anchors.length).toBeGreaterThan(0);

  for (let chunkX = -4; chunkX <= 4; chunkX += 1) {
    for (let chunkZ = -4; chunkZ <= 4; chunkZ += 1) {
      const first = collectAnchors(source, chunkX, chunkZ, REQUEST_CHUNK_SIZE);
      const second = collectAnchors(source, chunkX, chunkZ, REQUEST_CHUNK_SIZE);
      expect(anchorKeys(second)).toEqual(anchorKeys(first));
      for (const anchor of first) {
        expect(anchor.worldX).toBeGreaterThanOrEqual(
          chunkX * REQUEST_CHUNK_SIZE,
        );
        expect(anchor.worldX).toBeLessThan((chunkX + 1) * REQUEST_CHUNK_SIZE);
        expect(anchor.worldZ).toBeGreaterThanOrEqual(
          chunkZ * REQUEST_CHUNK_SIZE,
        );
        expect(anchor.worldZ).toBeLessThan((chunkZ + 1) * REQUEST_CHUNK_SIZE);
        expect(WORLD_SURFACE.zoneAt(anchor.worldX, anchor.worldZ)).not.toBe(
          "water",
        );
        expect(anchor.worldY).toBeCloseTo(
          WORLD_SURFACE.groundYAt(anchor.worldX, anchor.worldZ),
          5,
        );
      }
    }
  }
});

test("Static anchor sub-chunks partition their whole placement chunk", () => {
  for (const source of [
    createVegetationConnectionSource(DENSITY_PRESET, WORLD_SURFACE),
    createRockConnectionSource(
      { instancesPerHectareByZone: { meadow: 8, shrubSlope: 60 } },
      WORLD_SURFACE,
    ),
  ]) {
    const whole = collectAnchors(source, 1, -1, 64);
    const parts = [
      ...collectAnchors(source, 2, -2, REQUEST_CHUNK_SIZE),
      ...collectAnchors(source, 3, -2, REQUEST_CHUNK_SIZE),
      ...collectAnchors(source, 2, -1, REQUEST_CHUNK_SIZE),
      ...collectAnchors(source, 3, -1, REQUEST_CHUNK_SIZE),
    ];
    expect(anchorKeys(parts)).toEqual(anchorKeys(whole));
  }
});

test("Scent clearing anchors stay in forest and partition their chunk", () => {
  const source = createScentConnectionSource(
    WORLD_SURFACE.groundYAt,
    WORLD_SURFACE.zoneAt,
  );
  const anchors = collectWindowAnchors(source, 8);
  expect(anchors.length).toBeGreaterThan(0);

  for (const anchor of anchors) {
    const zone = WORLD_SURFACE.zoneAt(anchor.worldX, anchor.worldZ);
    expect(["coniferForest", "deciduousForest"]).toContain(zone);
    const height =
      anchor.worldY - WORLD_SURFACE.groundYAt(anchor.worldX, anchor.worldZ);
    expect(height).toBeGreaterThanOrEqual(CLEARING_MINIMUM_HEIGHT_METERS);
    expect(height).toBeLessThanOrEqual(CLEARING_MAXIMUM_HEIGHT_METERS);
  }

  // Splitting one 64-metre clearing chunk into its four 32-metre requests
  // must reproduce every direct anchor exactly once.
  for (let clearingChunk = -3; clearingChunk <= 3; clearingChunk += 1) {
    const whole = collectAnchors(source, clearingChunk, clearingChunk, 64);
    const parts: Anchor[] = [];
    for (let subX = 0; subX < 2; subX += 1) {
      for (let subZ = 0; subZ < 2; subZ += 1) {
        parts.push(
          ...collectAnchors(
            source,
            clearingChunk * 2 + subX,
            clearingChunk * 2 + subZ,
            REQUEST_CHUNK_SIZE,
          ),
        );
      }
    }
    expect(anchorKeys(parts)).toEqual(anchorKeys(whole));
  }
});

test("Scent sources are the very plants the web links, not a second world", () => {
  const scentSource = createVegetationScentSource(
    DENSITY_PRESET,
    WORLD_SURFACE,
  );
  const webSource = createVegetationConnectionSource(
    DENSITY_PRESET,
    WORLD_SURFACE,
  );

  for (let chunkX = -2; chunkX <= 2; chunkX += 1) {
    for (let chunkZ = -2; chunkZ <= 2; chunkZ += 1) {
      const plants: Anchor[] = [];
      scentSource.appendChunkPlants(
        chunkX,
        chunkZ,
        64,
        (worldX, groundY, worldZ, heightMeters, groupIndex) => {
          expect(heightMeters).toBeGreaterThan(0);
          expect(scentSource.groupIds[groupIndex]).toBeDefined();
          plants.push({ worldX, worldY: groundY, worldZ });
        },
      );

      expect(plants.length).toBeLessThanOrEqual(
        scentSource.maxPlantsPerChunk(64),
      );
      expect(anchorKeys(plants)).toEqual(
        anchorKeys(collectAnchors(webSource, chunkX, chunkZ, 64)),
      );
    }
  }
});
