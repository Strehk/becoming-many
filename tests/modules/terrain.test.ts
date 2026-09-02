/**
 * Purpose: Verify fixed-capacity terrain streaming against the shared world contracts.
 * Context: The terrain module is the first generated chunk consumer in the project.
 * Responsibility: Cover resident mesh capacity, row jobs, slot recycling, and cleanup.
 * Boundary: World-surface formulas and physical PICO frame timing are tested separately.
 */

import { expect, test } from "bun:test";
import {
  BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector3,
} from "three";
import {
  createTerrainModule,
  type TerrainParameters,
} from "../../src/modules/terrain/terrain";
import type {
  TerrainMaterialEffect,
  TerrainPresentation,
} from "../../src/modules/terrain/terrain-geometry";
import { createZoneVisualizer } from "../../src/modules/zone-visualizer/zone-visualizer";
import { StreamQueue } from "../../src/world/stream-queue";
import type { Viewpoint } from "../../src/world/viewer-rig";
import { WORLD_SURFACE_SETTINGS } from "../../src/world-surface/surface-settings";
import {
  createWorldSurface,
  type WorldSurface,
} from "../../src/world-surface/world-surface";
import { ZONE_SETTINGS } from "../../src/world-surface/zone-settings";

const TERRAIN_VERTEX_ROWS = 33;
const DEFAULT_TERRAIN_PARAMETERS: TerrainParameters = {
  opacity: 1,
};

test("Terrain recycles a fixed mesh pool through cooperative row jobs", () => {
  const loadedTerrain = createLoadedTerrain();
  const meshes = getTerrainMeshes(loadedTerrain.terrainGroup);
  const initialResources = captureMeshResources(meshes);

  loadedTerrain.viewerPosition.x = 64;
  loadedTerrain.module.update?.(1 / 90);

  expect(loadedTerrain.streamQueue.size).toBe(3);
  runQueuedTerrainRows(loadedTerrain.streamQueue, TERRAIN_VERTEX_ROWS);
  expect(loadedTerrain.streamQueue.size).toBe(0);
  expectMeshResourcesReused(meshes, initialResources);

  loadedTerrain.module.deactivate();
  expect(loadedTerrain.terrainGroup.visible).toBe(false);

  const disposal = trackResourceDisposal(meshes);
  loadedTerrain.module.unload();
  expect(loadedTerrain.scene.children).toHaveLength(0);
  expect(disposal.geometryCount).toBe(9);
  expect(disposal.materialCount).toBe(1);
});

test("Terrain applies opacity and omits unused texture coordinates", () => {
  const loadedTerrain = createLoadedTerrain(undefined, { opacity: 0.4 });
  const mesh = loadedTerrain.terrainGroup.children[0];

  expect(loadedTerrain.terrainGroup.visible).toBe(true);
  expect(mesh).toBeInstanceOf(Mesh);
  if (!(mesh instanceof Mesh)) throw new Error("Expected Mesh");
  if (Array.isArray(mesh.material)) throw new Error("Expected one material");
  expect(mesh.material.opacity).toBe(0.4);
  expect(mesh.material.transparent).toBe(true);
  expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
});

test("Terrain advances and disposes its supplied presentation", () => {
  const updates: number[] = [];
  const material = new MeshBasicMaterial();
  let materialDisposals = 0;
  material.dispose = () => {
    materialDisposals += 1;
  };
  const loadedTerrain = createLoadedTerrain(
    undefined,
    DEFAULT_TERRAIN_PARAMETERS,
    {
      material,
      update: (deltaSeconds) => updates.push(deltaSeconds),
    },
  );

  loadedTerrain.module.update?.(0.25);
  loadedTerrain.module.unload();

  expect(updates).toEqual([0.25]);
  expect(materialDisposals).toBe(1);
});

test("Terrain applies and advances material effects", () => {
  const updates: number[] = [];
  let appliedMaterial: MeshBasicMaterial | undefined;
  const effect: TerrainMaterialEffect = {
    applyTo: (material) => {
      appliedMaterial = material;
    },
    update: (deltaSeconds) => updates.push(deltaSeconds),
  };
  const loadedTerrain = createLoadedTerrain(
    undefined,
    DEFAULT_TERRAIN_PARAMETERS,
    undefined,
    [effect],
  );

  loadedTerrain.module.update?.(0.25);

  expect(appliedMaterial).toBeDefined();
  expect(updates).toEqual([0.25]);
});

test("Terrain samples shared border heights identically", () => {
  const { terrainGroup } = createLoadedTerrain();
  const heightsByWorldPosition = new Map<string, number>();
  const samples = getTerrainMeshes(terrainGroup).flatMap(readMeshVertices);
  let sharedVertexCount = 0;

  for (const sample of samples) {
    const key = `${sample.worldX.toFixed(4)}:${sample.worldZ.toFixed(4)}`;
    const previousHeight = heightsByWorldPosition.get(key);
    if (previousHeight === undefined) {
      heightsByWorldPosition.set(key, sample.heightY);
      continue;
    }

    sharedVertexCount += 1;
    expect(sample.heightY).toBeCloseTo(previousHeight, 6);
  }

  expect(sharedVertexCount).toBeGreaterThan(0);
});

test("Terrain samples shared border zone conditions identically", () => {
  const worldSurface = createTestWorldSurface();
  const presentation = createZoneVisualizer(worldSurface, ZONE_SETTINGS);
  const { terrainGroup } = createLoadedTerrain(
    worldSurface,
    DEFAULT_TERRAIN_PARAMETERS,
    presentation,
  );
  const conditionsByWorldPosition = new Map<string, readonly number[]>();
  let sharedVertexCount = 0;

  for (const sample of getTerrainZoneSamples(terrainGroup)) {
    const key = `${sample.worldX.toFixed(4)}:${sample.worldZ.toFixed(4)}`;
    const previousConditions = conditionsByWorldPosition.get(key);
    if (!previousConditions) {
      conditionsByWorldPosition.set(key, sample.conditions);
      continue;
    }

    sharedVertexCount += 1;
    expect(sample.conditions).toEqual(previousConditions);
  }

  expect(sharedVertexCount).toBeGreaterThan(0);
});

test("Terrain renders carved ground and leaves water height to Rivers", () => {
  const worldSurface = createTestWorldSurface();
  const { terrainGroup } = createLoadedTerrain(worldSurface);
  const groundY = worldSurface.groundYAt(0, 0);
  const surfaceY = worldSurface.surfaceYAt(0, 0);
  const terrainVertex = findTerrainVertex(terrainGroup, 0, 0);

  expect(worldSurface.zoneAt(0, 0)).toBe("water");
  expect(surfaceY).toBeGreaterThan(groundY);
  expect(terrainVertex?.heightY).toBeCloseTo(groundY, 6);
});

test("Terrain never queries zones while generating geometry", () => {
  const heightOnlySurface: WorldSurface = {
    groundYAt: () => 0,
    surfaceYAt: () => 0,
    zoneConditionsAt: () => {
      throw new Error("Terrain must not query zone conditions");
    },
    zoneAt: () => {
      throw new Error("Terrain must not query zones");
    },
  };

  const { terrainGroup } = createLoadedTerrain(heightOnlySurface);
  const meshes = getTerrainMeshes(terrainGroup);
  expect(meshes).toHaveLength(9);
  expect(meshes[0]?.geometry.getAttribute("zoneConditions")).toBeUndefined();
});

test("Terrain writes optional zone conditions into its existing mesh pool", () => {
  const worldSurface = createTestWorldSurface();
  const presentation = createZoneVisualizer(worldSurface, ZONE_SETTINGS);
  const { terrainGroup } = createLoadedTerrain(
    worldSurface,
    DEFAULT_TERRAIN_PARAMETERS,
    presentation,
  );
  const meshes = getTerrainMeshes(terrainGroup);
  const material = meshes[0]?.material;
  if (!material || Array.isArray(material)) {
    throw new Error("Expected one material");
  }

  expect(material.vertexColors).toBe(false);
  expect(meshes.every(hasZoneConditionsAttribute)).toBe(true);
  expect(meshes.every((mesh) => !mesh.geometry.hasAttribute("color"))).toBe(
    true,
  );
});

test("Terrain writes optional thermal warmth into its existing mesh pool", () => {
  const effect: TerrainMaterialEffect = {
    applyTo: () => {},
    warmthAt: (_worldX, _worldZ, groundYMeters) =>
      groundYMeters > -8 ? 1 : 0.25,
  };
  const { terrainGroup } = createLoadedTerrain(
    undefined,
    DEFAULT_TERRAIN_PARAMETERS,
    undefined,
    [effect],
  );
  const meshes = getTerrainMeshes(terrainGroup);
  const attribute = meshes[0]?.geometry.getAttribute("thermalWarmth");
  if (!attribute) throw new Error("Expected a thermalWarmth attribute");

  expect(
    meshes.every((mesh) => mesh.geometry.hasAttribute("thermalWarmth")),
  ).toBe(true);
  expect(attribute.itemSize).toBe(1);
  expect([0.25, 1]).toContain(attribute.getX(0));

  const plainTerrain = createLoadedTerrain();
  const plainMesh = getTerrainMeshes(plainTerrain.terrainGroup)[0];
  expect(plainMesh?.geometry.hasAttribute("thermalWarmth")).toBe(false);
});

test("Terrain replaces obsolete partially generated work", () => {
  const { viewerPosition, module, streamQueue, terrainGroup } =
    createLoadedTerrain();

  viewerPosition.x = 64;
  module.update?.(1 / 90);
  streamQueue.update();

  viewerPosition.x = 256;
  module.update?.(1 / 90);
  streamQueue.update();

  expect(terrainGroup.children.some((child) => child.position.x === 160)).toBe(
    false,
  );

  runQueuedTerrainRows(streamQueue, TERRAIN_VERTEX_ROWS);
  const residentCentersX = new Set(
    terrainGroup.children.map((child) => child.position.x),
  );
  expect(residentCentersX).toEqual(new Set([224, 288, 352]));
});

interface MeshResources {
  readonly geometries: readonly Mesh["geometry"][];
  readonly positionArrays: readonly (BufferAttribute["array"] | undefined)[];
}

interface DisposalCount {
  geometryCount: number;
  materialCount: number;
}

interface LoadedTerrain {
  readonly scene: Scene;
  readonly viewerPosition: Vector3;
  readonly streamQueue: StreamQueue;
  readonly module: ReturnType<typeof createTerrainModule>;
  readonly terrainGroup: Group;
}

interface TerrainVertexSample {
  readonly worldX: number;
  readonly worldZ: number;
  readonly heightY: number;
}

interface TerrainZoneSample {
  readonly worldX: number;
  readonly worldZ: number;
  readonly conditions: readonly number[];
}

function createLoadedTerrain(
  worldSurface = createTestWorldSurface(),
  parameters: TerrainParameters = DEFAULT_TERRAIN_PARAMETERS,
  presentation?: TerrainPresentation,
  effects?: readonly TerrainMaterialEffect[],
): LoadedTerrain {
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
  const module = createTerrainModule({
    scene,
    viewpoint,
    worldSurface,
    streamQueue,
    parameters,
    presentation,
    effects,
  });

  module.load();
  module.activate();

  const terrainGroup = scene.children[0];
  if (!(terrainGroup instanceof Group)) throw new Error("Expected Group");

  return { scene, viewerPosition, streamQueue, module, terrainGroup };
}

function createTestWorldSurface(): WorldSurface {
  return createWorldSurface(WORLD_SURFACE_SETTINGS, ZONE_SETTINGS);
}

function hasZoneConditionsAttribute(mesh: Mesh): boolean {
  const attribute = mesh.geometry.getAttribute("zoneConditions");
  return attribute instanceof BufferAttribute && attribute.itemSize === 4;
}

function getTerrainZoneSamples(terrainGroup: Group): TerrainZoneSample[] {
  return getTerrainMeshes(terrainGroup).flatMap((mesh) => {
    const positions = mesh.geometry.getAttribute("position");
    const conditions = mesh.geometry.getAttribute("zoneConditions");
    if (!(positions instanceof BufferAttribute)) return [];
    if (!(conditions instanceof BufferAttribute)) return [];

    return Array.from({ length: positions.count }, (_, vertexIndex) => ({
      worldX: mesh.position.x + positions.getX(vertexIndex),
      worldZ: mesh.position.z + positions.getZ(vertexIndex),
      conditions: [
        conditions.getX(vertexIndex),
        conditions.getY(vertexIndex),
        conditions.getZ(vertexIndex),
        conditions.getW(vertexIndex),
      ],
    }));
  });
}

function getTerrainMeshes(terrainGroup: Group): Mesh[] {
  expect(terrainGroup.visible).toBe(true);
  expect(terrainGroup.children).toHaveLength(9);

  return terrainGroup.children.map((child) => {
    if (!(child instanceof Mesh)) throw new Error("Expected Mesh");
    return child;
  });
}

function captureMeshResources(meshes: readonly Mesh[]): MeshResources {
  const geometries = meshes.map(({ geometry }) => geometry);
  const positionArrays = geometries.map(
    (geometry) => geometry.attributes.position?.array,
  );

  return { geometries, positionArrays };
}

function expectMeshResourcesReused(
  meshes: readonly Mesh[],
  initial: MeshResources,
): void {
  for (let slotIndex = 0; slotIndex < meshes.length; slotIndex += 1) {
    const geometry = meshes[slotIndex]?.geometry;
    expect(geometry).toBe(initial.geometries[slotIndex]);
    expect(geometry?.attributes.position?.array).toBe(
      initial.positionArrays[slotIndex],
    );
  }
}

function trackResourceDisposal(meshes: readonly Mesh[]): DisposalCount {
  const count = { geometryCount: 0, materialCount: 0 };

  for (const { geometry } of meshes) {
    geometry.dispose = () => {
      count.geometryCount += 1;
    };
  }

  const material = meshes[0]?.material;
  if (!material || Array.isArray(material))
    throw new Error("Expected material");
  material.dispose = () => {
    count.materialCount += 1;
  };

  return count;
}

function readMeshVertices(mesh: Mesh): TerrainVertexSample[] {
  const positions = mesh.geometry.getAttribute("position");
  if (!(positions instanceof BufferAttribute)) throw new Error("No positions");

  return Array.from({ length: positions.count }, (_, vertexIndex) => ({
    worldX: mesh.position.x + positions.getX(vertexIndex),
    worldZ: mesh.position.z + positions.getZ(vertexIndex),
    heightY: positions.getY(vertexIndex),
  }));
}

function findTerrainVertex(
  terrainGroup: Group,
  worldX: number,
  worldZ: number,
): TerrainVertexSample | undefined {
  for (const child of terrainGroup.children) {
    if (!(child instanceof Mesh)) continue;

    const match = readMeshVertices(child).find(
      (vertex) =>
        Math.abs(vertex.worldX - worldX) < 0.0001 &&
        Math.abs(vertex.worldZ - worldZ) < 0.0001,
    );
    if (match) return match;
  }

  return undefined;
}

function runQueuedTerrainRows(queue: StreamQueue, rowCount: number): void {
  for (let row = 0; row < rowCount; row += 1) queue.update();
}
