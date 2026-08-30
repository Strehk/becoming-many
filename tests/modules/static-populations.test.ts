/**
 * Purpose: Verify fixed-capacity placement for zone-driven static content.
 * Context: Vegetation and Rocks share candidates but own separate render resources.
 * Responsibility: Cover multi-part assets, water exclusion, and complete lifecycle cleanup.
 * Boundary: Real asset appearance and headset performance require browser and PICO checks.
 */

import { expect, test } from "bun:test";
import {
  BoxGeometry,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  createRockInstances,
  disposeRockInstances,
  initializeRockChunks,
} from "../../src/modules/rocks/rock-instances";
import type {
  GroundZoneId,
  StaticPopulationParameters,
} from "../../src/modules/static-population";
import {
  createVegetationChunkWriter,
  createVegetationInstances,
  discardVegetationChunks,
  disposeVegetationInstances,
  initializeVegetationChunks,
  uploadVegetationChanges,
  writeNextVegetationRow,
} from "../../src/modules/vegetation/vegetation-instances";
import type { GltfAssets } from "../../src/utils/asset-loader/gltf-assets";
import type { SensedMaterial } from "../../src/utils/asset-loader/material-effect";
import type { WorldSurface } from "../../src/world-surface/world-surface";
import type { ZoneId } from "../../src/world-surface/zone-settings";

const ASSIGNMENT = {
  slotIndex: 0,
  revision: 1,
  chunkX: 0,
  chunkZ: 0,
  originX: 0,
  originZ: 0,
} as const;

const VEGETATION_COLORS = {
  trunkColor: 0x332211,
  leafColor: 0x225522,
  leafAccentColor: 0x448844,
  flowerColor: 0xcc6688,
} as const;

const ROCK_COLORS = {
  darkColor: 0x333333,
  lightColor: 0x999999,
} as const;

test("Vegetation keeps every mesh part of an accepted model", () => {
  const instances = createVegetationInstances({
    colors: VEGETATION_COLORS,
    parameters: createVegetationParameters("meadow"),
    assets: createMultiPartAssets("plant"),
    chunkSize: 16,
    chunkSlotCount: 1,
    worldSurface: createFlatSurface("meadow"),
  });

  initializeVegetationChunks(instances, [ASSIGNMENT]);

  expect(instances.modelPool.group.children).toHaveLength(2);
  expect(instances.modelPool.group.children.every(isInstancedMesh)).toBe(true);
  expect(readDrawCount(instances.modelPool.group.children[0])).toBe(4);
  expect(readDrawCount(instances.modelPool.group.children[1])).toBe(4);
  expect(readScale(instances.modelPool.group.children[0], 0)).toBeGreaterThan(
    0,
  );
  expect(readScale(instances.modelPool.group.children[1], 0)).toBeGreaterThan(
    0,
  );
  disposeVegetationInstances(instances);
});

test("Vegetation variation is stable and differs between world cells", () => {
  const first = createVegetationInstances({
    colors: VEGETATION_COLORS,
    parameters: createVegetationParameters("meadow"),
    assets: createMultiPartAssets("plant"),
    chunkSize: 16,
    chunkSlotCount: 1,
    worldSurface: createFlatSurface("meadow"),
  });
  const second = createVegetationInstances({
    colors: VEGETATION_COLORS,
    parameters: createVegetationParameters("meadow"),
    assets: createMultiPartAssets("plant"),
    chunkSize: 16,
    chunkSlotCount: 1,
    worldSurface: createFlatSurface("meadow"),
  });

  initializeVegetationChunks(first, [ASSIGNMENT]);
  initializeVegetationChunks(second, [ASSIGNMENT]);
  const firstTransforms = readTransforms(first.modelPool.group.children[0]);
  const secondTransforms = readTransforms(second.modelPool.group.children[0]);

  expect(firstTransforms).toEqual(secondTransforms);
  expect(new Set(firstTransforms.map(({ height }) => height))).toHaveLength(4);
  expect(
    new Set(firstTransforms.map(({ rotationY }) => rotationY)),
  ).toHaveLength(4);
  expect(new Set(firstTransforms.map(({ width }) => width))).toHaveLength(4);
  expect(new Set(firstTransforms.map(({ depth }) => depth))).toHaveLength(4);
  disposeVegetationInstances(first);
  disposeVegetationInstances(second);
});

test("Vegetation keeps complete model footprints outside river channels", () => {
  const instances = createVegetationInstances({
    colors: VEGETATION_COLORS,
    parameters: createVegetationParameters("meadow"),
    assets: createMultiPartAssets("plant"),
    chunkSize: 16,
    chunkSlotCount: 1,
    worldSurface: createFlatSurface("meadow", -0.01),
  });

  initializeVegetationChunks(instances, [ASSIGNMENT]);

  expect(readDrawCount(instances.modelPool.group.children[0])).toBe(0);
  disposeVegetationInstances(instances);
});

test("Vegetation applies shared material effects to every part material", () => {
  const decorated: SensedMaterial[] = [];
  const instances = createVegetationInstances({
    colors: VEGETATION_COLORS,
    parameters: createVegetationParameters("meadow"),
    assets: createMultiPartAssets("plant"),
    chunkSize: 16,
    chunkSlotCount: 1,
    worldSurface: createFlatSurface("meadow"),
    effects: [{ applyTo: (material) => decorated.push(material) }],
  });

  expect(decorated).toHaveLength(2);
  expect(new Set(decorated).size).toBe(2);
  expect(
    decorated.every((material) => material instanceof MeshBasicMaterial),
  ).toBe(true);
  disposeVegetationInstances(instances);
});

test("Rocks apply shared material effects to every part material", () => {
  const decorated: SensedMaterial[] = [];
  const instances = createRockInstances({
    colors: ROCK_COLORS,
    parameters: createRockParameters("meadow"),
    assets: createMultiPartAssets("rock"),
    chunkSize: 16,
    chunkSlotCount: 1,
    worldSurface: createFlatSurface("meadow"),
    effects: [{ applyTo: (material) => decorated.push(material) }],
  });

  expect(decorated).toHaveLength(2);
  expect(new Set(decorated).size).toBe(2);
  disposeRockInstances(instances);
});

test("Rocks exclude water and retain fixed multi-part buffers", () => {
  const instances = createRockInstances({
    colors: ROCK_COLORS,
    parameters: createRockParameters("meadow"),
    assets: createMultiPartAssets("rock"),
    chunkSize: 16,
    chunkSlotCount: 1,
    worldSurface: createFlatSurface("water"),
  });

  initializeRockChunks(instances, [ASSIGNMENT]);

  expect(instances.modelPool.group.children).toHaveLength(2);
  expect(readDrawCount(instances.modelPool.group.children[0])).toBe(0);
  expect(readDrawCount(instances.modelPool.group.children[1])).toBe(0);
  disposeRockInstances(instances);
});

test("recycling hides only the outgoing Vegetation slot", () => {
  const instances = createVegetationInstances({
    colors: VEGETATION_COLORS,
    parameters: createVegetationParameters("meadow"),
    assets: createMultiPartAssets("plant"),
    chunkSize: 16,
    chunkSlotCount: 2,
    worldSurface: createFlatSurface((worldX) =>
      worldX < 32 ? "meadow" : "water",
    ),
  });
  initializeVegetationChunks(instances, [
    ASSIGNMENT,
    { ...ASSIGNMENT, slotIndex: 1, chunkX: 1, originX: 16 },
  ]);
  const mesh = instances.modelPool.group.children[0];
  expect(readDrawCount(mesh)).toBe(8);

  const firstWriter = createVegetationChunkWriter({
    ...ASSIGNMENT,
    revision: 2,
    chunkX: 2,
    originX: 32,
  });
  discardVegetationChunks(instances, [firstWriter.assignment]);
  uploadVegetationChanges(instances);
  expect(readDrawCount(mesh)).toBe(4);

  expect(writeNextVegetationRow(instances, firstWriter)).toBe(false);
  expect(writeNextVegetationRow(instances, firstWriter)).toBe(true);
  uploadVegetationChanges(instances);
  expect(readDrawCount(mesh)).toBe(4);
  disposeVegetationInstances(instances);
});

function createVegetationParameters(
  zone: GroundZoneId,
): StaticPopulationParameters {
  return {
    seed: 1,
    candidateSpacingMeters: 8,
    assets: [createAssetSettings("plant")],
    instancesPerHectareByZone: {
      [zone]: 156.25,
    },
    variantsByZone: {
      [zone]: [{ assetId: "plant", weight: 1 }],
    },
  };
}

function createRockParameters(zone: GroundZoneId): StaticPopulationParameters {
  return {
    seed: 2,
    candidateSpacingMeters: 8,
    assets: [createAssetSettings("rock")],
    instancesPerHectareByZone: {
      [zone]: 156.25,
    },
    variantsByZone: {
      [zone]: [{ assetId: "rock", weight: 1 }],
    },
  };
}

function createAssetSettings(id: string) {
  return {
    id,
    url: `/${id}.glb`,
    objectName: "Model",
    minimumHeightMeters: 1,
    maximumHeightMeters: 2,
  } as const;
}

function createMultiPartAssets(id: string): GltfAssets {
  const scene = new Group();
  const model = new Group();
  model.name = "Model";
  model.add(createMesh(0), createMesh(1));
  scene.add(model);
  return new Map([[id, createGltf(scene)]]);
}

function createMesh(x: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  mesh.position.x = x;
  return mesh;
}

function createGltf(scene: Group): GLTF {
  return {
    animations: [],
    asset: {},
    cameras: [],
    parser: {} as GLTF["parser"],
    scene,
    scenes: [scene],
    userData: {},
  };
}

function createFlatSurface(
  zone: ZoneId | ((worldX: number) => ZoneId),
  riverChannelMarginMeters = -100,
): WorldSurface {
  return {
    groundYAt: () => 2,
    surfaceYAt: () => 2,
    zoneConditionsAt: () => ({
      riverChannelMarginMeters,
      waterDepthMeters: -1,
      groundSlope: 0,
      forestRegionValue: 0,
    }),
    zoneAt: (worldX) => (typeof zone === "function" ? zone(worldX) : zone),
  };
}

function isInstancedMesh(object: unknown): object is InstancedMesh {
  return object instanceof InstancedMesh;
}

function readScale(object: unknown, instanceIndex: number): number {
  if (!(object instanceof InstancedMesh)) {
    throw new Error("Expected InstancedMesh");
  }
  const matrix = new Matrix4();
  object.getMatrixAt(instanceIndex, matrix);
  const scale = new Vector3();
  matrix.decompose(new Vector3(), new Quaternion(), scale);
  return scale.length();
}

function readDrawCount(object: unknown): number {
  if (!(object instanceof InstancedMesh)) {
    throw new Error("Expected InstancedMesh");
  }
  return object.count;
}

function readTransforms(object: unknown) {
  if (!(object instanceof InstancedMesh)) {
    throw new Error("Expected InstancedMesh");
  }

  return Array.from({ length: object.count }, (_, instanceIndex) => {
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const scale = new Vector3();
    object.getMatrixAt(instanceIndex, matrix);
    matrix.decompose(new Vector3(), rotation, scale);
    const rotationY = new Euler().setFromQuaternion(rotation, "YXZ").y;

    return {
      width: scale.x.toFixed(6),
      height: scale.y.toFixed(6),
      depth: scale.z.toFixed(6),
      rotationY: rotationY.toFixed(6),
    };
  });
}
