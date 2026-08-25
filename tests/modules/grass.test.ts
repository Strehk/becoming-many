/**
 * Purpose: Verify Grass against the shared streaming and world-surface contracts.
 * Context: The first vegetation consumer combines fixed instancing with generated placement.
 * Responsibility: Cover deterministic roots, authored zone rules, recycling, animation, and disposal.
 * Boundary: Visual density and physical PICO frame timing require runtime acceptance.
 */

import { expect, test } from "bun:test";
import { Mesh, PerspectiveCamera, Scene, Vector2 } from "three";
import { createGrassModule } from "../../src/modules/grass/grass";
import {
  createGrassField,
  disposeGrassField,
  type GrassPreset,
  initializeGrassChunks,
} from "../../src/modules/grass/grass-field";
import { StreamQueue } from "../../src/world/stream-queue";
import { WORLD_WIND } from "../../src/world/wind";
import type { WorldSurface } from "../../src/world-surface/world-surface";
import type { ZoneId } from "../../src/world-surface/zone-settings";

const TEST_PRESET: GrassPreset = {
  rootColor: 0x112233,
  tipColor: 0x445566,
  zones: {
    meadow: {
      tuftsPerSquareMeter: 1 / 16,
      bladeHeightMeters: 0.75,
    },
    shrubSlope: {
      tuftsPerSquareMeter: 1 / 16,
      bladeHeightMeters: 0.22,
    },
  },
};

test("Grass recreates stable roots for the same absolute chunks", () => {
  const first = createTwoChunkInstances();
  const repeated = createTwoChunkInstances();

  expect(repeated).toEqual(first);
  expect(readSlot(first, 0)).not.toEqual(readSlot(first, 1));
});

test("Grass follows the authored zone visibility and height rules", () => {
  const zones: readonly ZoneId[] = [
    "water",
    "meadow",
    "coniferForest",
    "deciduousForest",
    "shrubSlope",
  ];
  const field = createGrassField({
    parameters: createGrassPreset(1 / 256),
    chunkSize: 16,
    chunkSlotCount: zones.length,
    worldSurface: createFlatSurface(
      (worldX) => zones[Math.floor(worldX / 16)] ?? "water",
    ),
  });

  initializeGrassChunks(
    field,
    zones.map((_, chunkX) => createAssignment(chunkX, chunkX)),
  );

  const seeds = zones.map(
    (_, slotIndex) => field.renderedInstances[slotIndex * 4 + 3],
  );
  expect(seeds[0]).toBe(-1);
  expect(seeds[1]).toBeGreaterThanOrEqual(0);
  expect(seeds[1]).toBeLessThan(1);
  expect(seeds[2]).toBe(-1);
  expect(seeds[3]).toBe(-1);
  expect(seeds[4]).toBeGreaterThanOrEqual(1);
  expect(seeds[4]).toBeLessThan(2);
  expect(field.mesh.material.uniforms.grassMeadowHeight?.value).toBe(0.75);
  expect(field.mesh.material.uniforms.grassShrubSlopeHeightScale?.value).toBe(
    0.22 / 0.75,
  );
  const windDirection = field.mesh.material.uniforms.grassWindDirection?.value;
  expect(windDirection).toBeInstanceOf(Vector2);
  if (!(windDirection instanceof Vector2)) {
    throw new Error("Expected a grass wind direction");
  }
  expect(windDirection.toArray()).toEqual([...WORLD_WIND.directionXZ]);
  expect(field.mesh.material.uniforms.grassWindStrength?.value).toBe(
    WORLD_WIND.strength,
  );
  expect(field.mesh.material.uniforms.grassWindSpeed?.value).toBe(
    WORLD_WIND.speed,
  );
  disposeGrassField(field);
});

test("Grass applies density independently in each configured zone", () => {
  const field = createGrassField({
    parameters: {
      rootColor: TEST_PRESET.rootColor,
      tipColor: TEST_PRESET.tipColor,
      zones: {
        meadow: {
          tuftsPerSquareMeter: 1,
          bladeHeightMeters: 0.75,
        },
        shrubSlope: {
          tuftsPerSquareMeter: 0.25,
          bladeHeightMeters: 0.22,
        },
      },
    },
    chunkSize: 16,
    chunkSlotCount: 2,
    worldSurface: createFlatSurface((worldX) =>
      worldX < 16 ? "meadow" : "shrubSlope",
    ),
  });

  initializeGrassChunks(field, [
    createAssignment(0, 0),
    createAssignment(1, 1),
  ]);

  const meadowCount = countVisibleGrass(field, 0);
  const shrubSlopeCount = countVisibleGrass(field, 1);
  expect(meadowCount).toBe(field.tuftsPerChunk);
  expect(shrubSlopeCount).toBeGreaterThan(0);
  expect(shrubSlopeCount).toBeLessThan(meadowCount);
  disposeGrassField(field);
});

test("Grass rejects shrub-slope blades taller than meadow blades", () => {
  expect(() =>
    createGrassField({
      parameters: {
        rootColor: TEST_PRESET.rootColor,
        tipColor: TEST_PRESET.tipColor,
        zones: {
          ...TEST_PRESET.zones,
          shrubSlope: {
            tuftsPerSquareMeter: 1 / 16,
            bladeHeightMeters: 0.76,
          },
        },
      },
      chunkSize: 16,
      chunkSlotCount: 1,
      worldSurface: createFlatSurface(() => "shrubSlope"),
    }),
  ).toThrow("Shrub-slope grass must be no taller than meadow grass");
});

test("Grass keeps one fixed draw while recycling chunk ranges", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 24);
  const streamQueue = new StreamQueue(
    { budgetMilliseconds: 1, capacity: 256 },
    () => 0,
  );
  const module = createGrassModule({
    scene,
    camera,
    streamQueue,
    worldSurface: createFlatSurface(() => "meadow"),
    preset: createGrassPreset(1 / 4_096),
  });

  module.load();
  module.activate();

  const mesh = scene.children[0];
  expect(mesh).toBeInstanceOf(Mesh);
  if (!(mesh instanceof Mesh)) throw new Error("Expected Grass Mesh");
  if (Array.isArray(mesh.material)) throw new Error("Expected one material");
  const geometry = mesh.geometry;
  const instanceAttribute = geometry.getAttribute("grassInstance");
  if (!instanceAttribute) throw new Error("Expected grass instances");
  const instanceArray = instanceAttribute.array;
  const timeUniform = mesh.material.uniforms.grassTime;

  expect(scene.children).toEqual([mesh]);
  expect(mesh.visible).toBe(true);
  expect(geometry.instanceCount).toBe(25);
  expect(instanceAttribute.updateRanges).toHaveLength(0);

  camera.position.x = 64;
  module.update?.(0.5);
  expect(streamQueue.size).toBe(5);
  streamQueue.update();

  expect(streamQueue.size).toBe(0);
  expect(scene.children).toEqual([mesh]);
  expect(mesh.geometry).toBe(geometry);
  expect(instanceAttribute.array).toBe(instanceArray);
  expect(instanceAttribute.updateRanges).toHaveLength(5);
  expect(timeUniform?.value).toBe(0.5);

  module.deactivate();
  expect(mesh.visible).toBe(false);

  let geometryDisposals = 0;
  let materialDisposals = 0;
  geometry.dispose = () => {
    geometryDisposals += 1;
  };
  mesh.material.dispose = () => {
    materialDisposals += 1;
  };
  module.unload();

  expect(scene.children).toHaveLength(0);
  expect(geometryDisposals).toBe(1);
  expect(materialDisposals).toBe(1);
});

function createTwoChunkInstances(): number[] {
  const field = createGrassField({
    parameters: TEST_PRESET,
    chunkSize: 4,
    chunkSlotCount: 2,
    worldSurface: createFlatSurface(() => "meadow"),
  });
  initializeGrassChunks(field, [
    createAssignment(0, 0),
    createAssignment(1, 1),
  ]);
  const instances = Array.from(field.renderedInstances);
  disposeGrassField(field);
  return instances;
}

function createGrassPreset(tuftsPerSquareMeter: number): GrassPreset {
  return {
    rootColor: TEST_PRESET.rootColor,
    tipColor: TEST_PRESET.tipColor,
    zones: {
      meadow: {
        tuftsPerSquareMeter,
        bladeHeightMeters: 0.75,
      },
      shrubSlope: {
        tuftsPerSquareMeter,
        bladeHeightMeters: 0.22,
      },
    },
  };
}

function readSlot(instances: readonly number[], slotIndex: number): number[] {
  const valuesPerSlot = 4;
  return instances.slice(
    slotIndex * valuesPerSlot,
    (slotIndex + 1) * valuesPerSlot,
  );
}

function countVisibleGrass(
  field: ReturnType<typeof createGrassField>,
  slotIndex: number,
): number {
  let visibleCount = 0;
  const firstInstance = slotIndex * field.tuftsPerChunk;
  const lastInstance = firstInstance + field.tuftsPerChunk;

  for (
    let instanceIndex = firstInstance;
    instanceIndex < lastInstance;
    instanceIndex += 1
  ) {
    const seedOffset = instanceIndex * 4 + 3;
    if ((field.renderedInstances[seedOffset] ?? -1) >= 0) visibleCount += 1;
  }

  return visibleCount;
}

function createFlatSurface(zoneAt: WorldSurface["zoneAt"]): WorldSurface {
  return {
    groundYAt: () => 2,
    surfaceYAt: () => 2,
    zoneConditionsAt: () => ({
      riverChannelMarginMeters: -1,
      waterDepthMeters: -1,
      groundSlope: 0,
      forestRegionValue: 0,
    }),
    zoneAt,
  };
}

function createAssignment(slotIndex: number, chunkX: number) {
  return {
    slotIndex,
    revision: 1,
    chunkX,
    chunkZ: 0,
    originX: chunkX * 16,
    originZ: 0,
  } as const;
}
