/**
 * Purpose: Verify the clipmap grass field, its ground sampling, and its lifecycle.
 * Context: The field is ported from a standalone demo onto this world's noise-based surface.
 * Responsibility: Cover the layout invariants, the height encoding, refills, and disposal.
 * Boundary: Visual fidelity and target-device performance require runtime acceptance.
 */

import { expect, test } from "bun:test";
import {
  type DataTexture,
  DataUtils,
  type Group,
  type Mesh,
  PerspectiveCamera,
  Scene,
  type ShaderMaterial,
} from "three";
import { createGrassClipmapModule } from "../../src/modules/grass-clipmap/grass-clipmap";
import {
  getGrassLevelAllocation,
  getGuaranteedMarginMeters,
  getLegalRing,
} from "../../src/modules/grass-clipmap/grass-clipmap-field";
import {
  GRASS_CLIPMAP_SETTINGS,
  type GrassClipmapPreset,
} from "../../src/modules/grass-clipmap/grass-clipmap-settings";
import { createGrassHeightField } from "../../src/modules/grass-clipmap/grass-height-field";
import type {
  SensedMaterial,
  UnlitMaterialEffect,
} from "../../src/utils/asset-loader/material-effect";
import { StreamQueue } from "../../src/world/stream-queue";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import { createWorldSurface } from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

const PRESET: GrassClipmapPreset = {
  tuftsPerSquareMeter: 19,
  fullDensityRadiusMeters: 32,
  bladeHeightMeters: 3,
  bladeWidthMeters: 0.2,
  colors: { rootColor: 0x16240c, tipColor: 0x94c356 },
};

const worldSurface = createWorldSurface(WORLD_SURFACE_SETTINGS, ZONE_SETTINGS);

function createModuleOptions(scene: Scene, camera: PerspectiveCamera) {
  return {
    scene,
    camera,
    preset: PRESET,
    streamQueue: new StreamQueue({ budgetMilliseconds: 4, capacity: 64 }),
    worldSurface,
    surfaceSettings: WORLD_SURFACE_SETTINGS,
    fogColor: 0xbcd4e0,
  };
}

test("the guaranteed grass margin covers the distance the blades fade at", () => {
  // Grid snapping means the camera does not sit at the centre of its own grid,
  // so the nominal extent is not what is guaranteed. If the margin fell short
  // of the fade, the field would end on a straight line instead of dissolving.
  expect(getGuaranteedMarginMeters()).toBeGreaterThanOrEqual(
    GRASS_CLIPMAP_SETTINGS.fade.endMeters,
  );
});

test("the ring stays even and wide enough for a multi-level clipmap", () => {
  // An odd ring drops the inner hole into the middle of a chunk; a ring below
  // four lets the camera stand on the outer edge of level zero, with a level
  // allocated for a multiple of that distance right behind it.
  expect(getLegalRing(3, 4)).toBe(4);
  expect(getLegalRing(2, 4)).toBe(4);
  expect(getLegalRing(6, 4)).toBe(6);
  // A single level has no coarser grid to meet, so it may snap finely.
  expect(getLegalRing(2, 1)).toBe(2);
  expect(getLegalRing(GRASS_CLIPMAP_SETTINGS.layout.ring, 4) % 2).toBe(0);
});

test("no allocation step is clamped by the shared instance buffer", () => {
  // A clamped step breaks the exact factor-of-four progression, and with it
  // the property that a step change starts a different number of instances
  // without changing which blades survive. That property is what keeps the
  // field from popping as the camera moves.
  for (let index = 0; index < GRASS_CLIPMAP_SETTINGS.layout.levels; index++) {
    const allocation = getGrassLevelAllocation(index, PRESET);
    expect(allocation.largestStepInstanceCount).toBeLessThanOrEqual(
      allocation.instanceCeiling,
    );
    expect(allocation.baseInstanceCount).toBeGreaterThan(16);
  }
});

test("every level allocates at least the density its inner edge demands", () => {
  // The shader can only take blades away, never add them: an allocation below
  // the law would run `keep` into its ceiling and thin the field out.
  for (let index = 1; index < GRASS_CLIPMAP_SETTINGS.layout.levels; index++) {
    const allocation = getGrassLevelAllocation(index, PRESET);
    const ratio =
      PRESET.fullDensityRadiusMeters /
      Math.max(allocation.innerEdgeMeters, PRESET.fullDensityRadiusMeters);
    const demanded = PRESET.tuftsPerSquareMeter * ratio * ratio;
    expect(allocation.allocatedDensity).toBeGreaterThanOrEqual(
      demanded * 0.999,
    );
  }
});

test("the height field reproduces the world surface it samples", () => {
  const settings = GRASS_CLIPMAP_SETTINGS.heightField;
  const heightField = createGrassHeightField({
    worldSurface,
    surfaceSettings: WORLD_SURFACE_SETTINGS,
    cameraX: 0,
    cameraZ: 0,
  });
  const texture = heightField.texture as DataTexture;
  const data = texture.image.data as Uint16Array;

  expect(texture.image.width).toBe(settings.sizeTexels);
  // Linear, so the blade root moves smoothly between samples; no mipmaps,
  // because a reduced height field would flatten the hills it stands on.
  expect(texture.generateMipmaps).toBe(false);
  // The window snaps to its own texel grid, so a refill never shifts the
  // sample points and the ground cannot ripple while walking.
  expect(Math.abs(heightField.placement.x % settings.texelMeters)).toBe(0);
  expect(Math.abs(heightField.placement.y % settings.texelMeters)).toBe(0);
  expect(heightField.placement.z).toBe(settings.texelMeters);
  expect(heightField.placement.w).toBe(settings.sizeTexels);

  for (const [column, row] of [
    [0, 0],
    [17, 42],
    [settings.sizeTexels - 1, settings.sizeTexels - 1],
  ]) {
    const worldX =
      heightField.placement.x + (column ?? 0) * settings.texelMeters;
    const worldZ = heightField.placement.y + (row ?? 0) * settings.texelMeters;
    const index = ((row ?? 0) * settings.sizeTexels + (column ?? 0)) * 2;
    const normalized = DataUtils.fromHalfFloat(data[index] ?? 0);
    const decoded = heightField.range.x + normalized * heightField.range.y;
    // Half float over the normalized elevation span resolves under two
    // centimetres, well below what a blade root can show.
    expect(decoded).toBeCloseTo(worldSurface.groundYAt(worldX, worldZ), 1);
  }

  heightField.dispose();
});

test("the height field leaves zones that grow no grass bare", () => {
  const settings = GRASS_CLIPMAP_SETTINGS.heightField;
  const heightField = createGrassHeightField({
    worldSurface,
    surfaceSettings: WORLD_SURFACE_SETTINGS,
    cameraX: 0,
    cameraZ: 0,
  });
  const data = (heightField.texture as DataTexture).image.data as Uint16Array;
  const coverage: Partial<Record<string, number>> =
    GRASS_CLIPMAP_SETTINGS.zoneCoverage;

  let bareFound = false;
  let coveredFound = false;
  for (let row = 0; row < settings.sizeTexels; row += 7) {
    for (let column = 0; column < settings.sizeTexels; column += 7) {
      const worldX = heightField.placement.x + column * settings.texelMeters;
      const worldZ = heightField.placement.y + row * settings.texelMeters;
      const index = (row * settings.sizeTexels + column) * 2 + 1;
      const stored = DataUtils.fromHalfFloat(data[index] ?? 0);
      const zone = worldSurface.zoneAt(worldX, worldZ);
      expect(stored).toBeCloseTo(coverage[zone] ?? 0, 3);
      if (stored === 0) bareFound = true;
      if (stored > 0) coveredFound = true;
    }
  }
  // Water and both forest zones are never grass zones, and the sampled window
  // has to contain both kinds of ground or the check proves nothing.
  expect(bareFound).toBe(true);
  expect(coveredFound).toBe(true);

  heightField.dispose();
});

function readBladeMaterial(group: Group): ShaderMaterial {
  const chunk = group.children[0] as Mesh;
  return chunk.material as ShaderMaterial;
}

test("the blade shaders carry the anchors a sense patches at", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const module = createGrassClipmapModule(createModuleOptions(scene, camera));

  module.load();
  const material = readBladeMaterial(scene.children[0] as Group);

  expect(material.vertexShader).toContain("#include <common>");
  expect(material.vertexShader).toContain("#include <project_vertex>");
  expect(material.fragmentShader).toContain("#include <color_fragment>");
  // Thermal multiplies `transformed` by the model matrix, so the vertex stage
  // has to hand over the local position. The chunk matrix is a pure
  // translation, which is what makes subtracting its column correct.
  expect(material.vertexShader).toContain("world - modelMatrix[3].xyz");
  // Without a sense the field lights itself, which is the demo's own look.
  expect(material.defines?.GRASS_LIT).toBe(1);

  module.unload();
});

test("a sense reaches every blade material and takes the lighting with it", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const patched: SensedMaterial[] = [];
  const effect: UnlitMaterialEffect = {
    applyTo: (material) => {
      patched.push(material);
    },
  };
  const module = createGrassClipmapModule({
    ...createModuleOptions(scene, camera),
    effects: [effect],
  });

  module.load();
  // Every tier and every allocation step of every level, or a chunk would
  // swap to a material the sense never saw.
  const stepCount =
    GRASS_CLIPMAP_SETTINGS.density.stepsUp +
    GRASS_CLIPMAP_SETTINGS.density.stepsDown +
    1;
  expect(patched).toHaveLength(
    GRASS_CLIPMAP_SETTINGS.layout.levels * 3 * stepCount,
  );
  for (const material of patched) {
    // The sense owns the color, so the lighting block is compiled out rather
    // than computed and discarded.
    expect((material as ShaderMaterial).defines?.GRASS_LIT).toBe(0);
  }

  module.unload();
});

test("a refused refill is retried instead of latching forever", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  let attempts = 0;
  // A queue that always refuses, the way the real one does once its memory
  // guard is full.
  const refusing = {
    size: 0,
    enqueue: () => {
      attempts++;
      return false;
    },
    update: () => {},
  } as unknown as StreamQueue;
  const module = createGrassClipmapModule({
    ...createModuleOptions(scene, camera),
    streamQueue: refusing,
  });

  module.load();
  camera.position.set(
    GRASS_CLIPMAP_SETTINGS.heightField.recenterMeters * 4,
    0,
    0,
  );
  module.update?.(0.016);
  module.update?.(0.016);

  // Every frame tries again. Latching on a refusal would leave the field
  // rooted in a window the camera has left, and outside that window the
  // clamped edge texel puts every blade at one wrong height.
  expect(attempts).toBe(2);

  module.unload();
});

test("the grass clipmap follows the world module lifecycle", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const module = createGrassClipmapModule(createModuleOptions(scene, camera));

  module.load();
  const group = scene.children[0] as Group;
  expect(group.children.length).toBeGreaterThan(0);
  // Loading happens before the first render, so nothing is visible yet.
  expect(group.visible).toBe(false);

  module.activate();
  expect(group.visible).toBe(true);

  module.update?.(0.016);
  module.deactivate();
  expect(group.visible).toBe(false);

  module.unload();
  expect(scene.children).toHaveLength(0);
});

test("walking out of the height window refills it in cooperative steps", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const options = createModuleOptions(scene, camera);
  const module = createGrassClipmapModule(options);

  module.load();
  module.activate();
  // Inside the window nothing is queued: the field keeps its sampled ground.
  module.update?.(0.016);
  expect(options.streamQueue.size).toBe(0);

  camera.position.set(
    GRASS_CLIPMAP_SETTINGS.heightField.recenterMeters * 4,
    0,
    0,
  );
  module.update?.(0.016);
  expect(options.streamQueue.size).toBe(1);

  // One step is not the whole window; the refill returns to the queue.
  options.streamQueue.update();
  expect(options.streamQueue.size).toBe(1);

  const steps =
    GRASS_CLIPMAP_SETTINGS.heightField.sizeTexels /
    GRASS_CLIPMAP_SETTINGS.heightField.rowsPerStep;
  for (let step = 0; step < steps; step++) options.streamQueue.update();
  expect(options.streamQueue.size).toBe(0);

  // A finished refill is not queued again while the camera stays put.
  module.update?.(0.016);
  expect(options.streamQueue.size).toBe(0);

  module.unload();
});
