/**
 * Purpose: Verify Grass against the shared streaming and world-surface contracts.
 * Context: The first vegetation consumer combines fixed instancing with generated placement.
 * Responsibility: Cover deterministic roots, zone rules, the sense hook, recycling, and disposal.
 * Boundary: Visual density and physical PICO frame timing require runtime acceptance.
 */

import { expect, test } from "bun:test";
import { Mesh, Scene, type ShaderMaterial, Vector2, Vector3 } from "three";
import { createEchoDepth } from "../../src/modules/echo-depth/echo-depth";
import { createGrassModule } from "../../src/modules/grass/grass";
import {
  createGrassField,
  disposeGrassField,
  type GrassPreset,
  initializeGrassChunks,
} from "../../src/modules/grass/grass-field";
import { StreamQueue } from "../../src/world/stream-queue";
import type { Viewpoint } from "../../src/world/viewer-rig";
import { WORLD_WIND } from "../../src/world/wind";
import type { WorldSurface } from "../../src/world-surface/world-surface";
import type { ZoneId } from "../../src/world-surface/zone-settings";

const ECHO_DEPTH = {
  intensity: 1,
  nearDistanceMeters: 6,
  farDistanceMeters: 120,
  colors: {
    nearColor: 0x101010,
    nearShadeColor: 0x171717,
    midColor: 0x494949,
    farColor: 0x959595,
    hazeColor: 0xf1f1f1,
  },
} as const;

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

test("Grass opens its own material-effect hook to a sense", () => {
  const field = createGrassField({
    parameters: TEST_PRESET,
    chunkSize: 16,
    chunkSlotCount: 1,
    worldSurface: createFlatSurface(() => "meadow"),
    effects: [createEchoDepth(ECHO_DEPTH)],
  });
  const material = field.mesh.material;
  const shader = createGrassShaderSource(material);

  material.onBeforeCompile(shader, undefined as never);

  // The three.js chunk anchors live in the module's own GLSL, so a sense
  // patches grass exactly as it patches a built-in material pass.
  expect(shader.vertexShader).toContain("passEchoDepth(mvPosition)");
  expect(shader.fragmentShader).toContain("applyEchoDepth(diffuseColor.rgb)");
  // The ramp measures the projected position and recolors the module's own
  // root-to-tip gradient, never the other way round.
  expect(
    shader.vertexShader.indexOf("passEchoDepth(mvPosition)"),
  ).toBeGreaterThan(shader.vertexShader.indexOf("#include <project_vertex>"));
  expect(
    shader.fragmentShader.indexOf("applyEchoDepth(diffuseColor.rgb)"),
  ).toBeGreaterThan(
    shader.fragmentShader.indexOf("mix(grassRootColor, grassTipColor"),
  );
  // One shared uniform set, so a future intensity driver reaches grass too.
  expect(shader.uniforms.echoIntensity?.value).toBe(1);
  expect(shader.uniforms.grassTipColor).toBeDefined();
  disposeGrassField(field);
});

test("Grass holds its own range instead of following the view distance", () => {
  const nearSlots = countGrassSlots(24);
  const farSlots = countGrassSlots(180);

  // The 2026-08-24 audit fix: a level that sees 180 m no longer drags the
  // grass window out to 9 x 9 chunks behind it.
  expect(farSlots).toBe(25);
  expect(farSlots).toBe(nearSlots);
});

test("Grass keeps one fixed draw while recycling chunk ranges", () => {
  const scene = new Scene();
  const viewerPosition = new Vector3();
  const viewpoint: Viewpoint = {
    worldPosition: viewerPosition,
    viewDistanceMeters: 24,
  };
  const streamQueue = new StreamQueue(
    { budgetMilliseconds: 1, capacity: 256 },
    () => 0,
  );
  const module = createGrassModule({
    scene,
    viewpoint,
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

  viewerPosition.x = 64;
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

function countGrassSlots(viewDistanceMeters: number): number {
  const scene = new Scene();
  const module = createGrassModule({
    scene,
    viewpoint: {
      worldPosition: new Vector3(),
      viewDistanceMeters: viewDistanceMeters,
    },
    streamQueue: new StreamQueue(
      { budgetMilliseconds: 1, capacity: 256 },
      () => 0,
    ),
    worldSurface: createFlatSurface(() => "meadow"),
    // One tuft per chunk, so the instance count is the resident slot count.
    preset: createGrassPreset(1 / 4_096),
  });

  module.load();
  const mesh = scene.children[0];
  if (!(mesh instanceof Mesh)) throw new Error("Expected Grass Mesh");
  const slotCount = mesh.geometry.instanceCount;
  module.unload();

  return slotCount;
}

/** Three.js hands a ShaderMaterial its own source and uniform object. */
function createGrassShaderSource(
  material: ShaderMaterial,
): Parameters<ShaderMaterial["onBeforeCompile"]>[0] {
  return {
    uniforms: material.uniforms,
    vertexShader: material.vertexShader,
    fragmentShader: material.fragmentShader,
  } as Parameters<ShaderMaterial["onBeforeCompile"]>[0];
}

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
