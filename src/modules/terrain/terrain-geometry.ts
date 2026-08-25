/**
 * Purpose: Store and render the fixed terrain chunk mesh pool.
 * Context: Terrain chunks change world assignments while their Three.js resources stay allocated.
 * Responsibility: Sample chunk rows, publish complete meshes, update bounds, and dispose resources.
 * Boundary: Chunk selection, queue scheduling, module lifecycle, and world-surface rules stay elsewhere.
 */

import {
  BufferAttribute,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";
import type { ChunkAssignment } from "../../world/chunk-system";
import type { WorldSurface } from "../../world-surface/world-surface";

const POSITION_COMPONENT_COUNT = 3;
const TERRAIN_COLOR = 0xdfe8d5;

interface TerrainGeometryOptions {
  readonly worldSurface: WorldSurface;
  readonly chunkSize: number;
  readonly chunkSlotCount: number;
  readonly segmentsPerSide: number;
  readonly opacity: number;
  readonly presentation?: TerrainPresentation;
  readonly effects?: readonly TerrainMaterialEffect[];
}

interface TerrainSlot {
  readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly positionAttribute: BufferAttribute;
  readonly zoneConditionsAttribute: Float32BufferAttribute | undefined;
  readonly stagedGroundHeights: Float32Array;
}

interface TerrainSlotOptions {
  readonly chunkSize: number;
  readonly segmentsPerSide: number;
  readonly material: MeshBasicMaterial;
  readonly storesZoneConditions: boolean;
}

export interface TerrainPresentation {
  readonly material: MeshBasicMaterial;
  readonly conditionsAt?: WorldSurface["zoneConditionsAt"];
  readonly update?: (deltaSeconds: number) => void;
}

export interface TerrainMaterialEffect {
  readonly applyTo: (material: MeshBasicMaterial) => void;
  readonly update?: (deltaSeconds: number) => void;
}

export interface TerrainGeometry {
  readonly group: Group;
  readonly worldSurface: WorldSurface;
  readonly chunkSize: number;
  readonly segmentsPerSide: number;
  readonly verticesPerSide: number;
  readonly material: MeshBasicMaterial;
  readonly slots: readonly TerrainSlot[];
  readonly presentation: TerrainPresentation | undefined;
  readonly effects: readonly TerrainMaterialEffect[];
}

export interface TerrainChunkWriter {
  readonly assignment: ChunkAssignment;
  readonly slot: TerrainSlot;
  nextRow: number;
}

/** Allocate every mesh and typed buffer once for the module's loaded lifetime. */
export function createTerrainGeometry({
  worldSurface,
  chunkSize,
  chunkSlotCount,
  segmentsPerSide,
  opacity,
  presentation,
  effects = [],
}: TerrainGeometryOptions): TerrainGeometry {
  const clampedOpacity = Math.min(Math.max(opacity, 0), 1);
  const material =
    presentation?.material ?? new MeshBasicMaterial({ color: TERRAIN_COLOR });
  material.opacity = clampedOpacity;
  material.transparent = clampedOpacity < 1;
  for (const effect of effects) effect.applyTo(material);

  const storesZoneConditions = presentation?.conditionsAt !== undefined;
  const group = new Group();
  const slots = Array.from({ length: chunkSlotCount }, () =>
    createTerrainSlot({
      chunkSize,
      segmentsPerSide,
      material,
      storesZoneConditions,
    }),
  );

  for (const slot of slots) group.add(slot.mesh);

  return {
    group,
    worldSurface,
    chunkSize,
    segmentsPerSide,
    verticesPerSide: segmentsPerSide + 1,
    material,
    slots,
    presentation,
    effects,
  };
}

/** Fill complete initial chunks before the first frame can display the group. */
export function initializeTerrainChunks(
  terrain: TerrainGeometry,
  assignments: readonly ChunkAssignment[],
): void {
  for (const assignment of assignments) {
    const writer = createTerrainChunkWriter(terrain, assignment);
    if (!writer) continue;

    while (!writeNextTerrainRow(terrain, writer)) {
      // Initial loading is synchronous; streamed replacements use one row per step.
    }
  }
}

export function createTerrainChunkWriter(
  terrain: TerrainGeometry,
  assignment: ChunkAssignment,
): TerrainChunkWriter | undefined {
  const slot = terrain.slots[assignment.slotIndex];
  if (!slot) return undefined;

  return {
    assignment,
    slot,
    nextRow: 0,
  };
}

/** Sample one row so StreamQueue can bound terrain work between frames. */
export function writeNextTerrainRow(
  terrain: TerrainGeometry,
  writer: TerrainChunkWriter,
): boolean {
  writeTerrainRow(terrain, writer, writer.nextRow);
  writer.nextRow += 1;

  if (writer.nextRow < terrain.verticesPerSide) return false;

  publishTerrainChunk(terrain, writer);
  return true;
}

export function disposeTerrainGeometry(terrain: TerrainGeometry): void {
  for (const slot of terrain.slots) slot.mesh.geometry.dispose();
  terrain.material.dispose();
}

function createTerrainSlot({
  chunkSize,
  segmentsPerSide,
  material,
  storesZoneConditions,
}: TerrainSlotOptions): TerrainSlot {
  const geometry = new PlaneGeometry(
    chunkSize,
    chunkSize,
    segmentsPerSide,
    segmentsPerSide,
  );
  geometry.rotateX(-Math.PI / 2);

  // MeshBasicMaterial needs no normals. UVs are retained only when the level
  // allows a texture map, keeping untextured terrain buffers smaller.
  geometry.deleteAttribute("normal");
  // UVs are added only when a real textured presentation requires them.
  geometry.deleteAttribute("uv");

  const positionAttribute = geometry.getAttribute("position");
  if (!(positionAttribute instanceof BufferAttribute)) {
    throw new Error("PlaneGeometry must provide a BufferAttribute position");
  }
  positionAttribute.setUsage(DynamicDrawUsage);

  const vertexCount = (segmentsPerSide + 1) ** 2;
  const zoneConditionsAttribute = createZoneConditionsAttribute(
    vertexCount,
    storesZoneConditions,
  );
  if (zoneConditionsAttribute) {
    geometry.setAttribute("zoneConditions", zoneConditionsAttribute);
  }

  const mesh = new Mesh(geometry, material);
  mesh.visible = false;

  return {
    mesh,
    positionAttribute,
    zoneConditionsAttribute,
    stagedGroundHeights: new Float32Array(vertexCount),
  };
}

function createZoneConditionsAttribute(
  vertexCount: number,
  storesZoneConditions: boolean,
): Float32BufferAttribute | undefined {
  if (!storesZoneConditions) return undefined;

  const attribute = new Float32BufferAttribute(vertexCount * 4, 4);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}

function writeTerrainRow(
  terrain: TerrainGeometry,
  writer: TerrainChunkWriter,
  row: number,
): void {
  const { assignment, slot } = writer;

  for (let column = 0; column < terrain.verticesPerSide; column += 1) {
    const vertexIndex = row * terrain.verticesPerSide + column;
    const worldX =
      assignment.originX +
      (column / terrain.segmentsPerSide) * terrain.chunkSize;
    const worldZ =
      assignment.originZ + (row / terrain.segmentsPerSide) * terrain.chunkSize;
    slot.stagedGroundHeights[vertexIndex] = terrain.worldSurface.groundYAt(
      worldX,
      worldZ,
    );
    writeZoneConditions(terrain, slot, vertexIndex, worldX, worldZ);
  }
}

function writeZoneConditions(
  terrain: TerrainGeometry,
  slot: TerrainSlot,
  vertexIndex: number,
  worldX: number,
  worldZ: number,
): void {
  const conditionsAt = terrain.presentation?.conditionsAt;
  const attribute = slot.zoneConditionsAttribute;
  if (!conditionsAt || !attribute) return;

  const conditions = conditionsAt(worldX, worldZ);
  attribute.setXYZW(
    vertexIndex,
    conditions.riverChannelMarginMeters,
    conditions.waterDepthMeters,
    conditions.groundSlope,
    conditions.forestRegionValue,
  );
}

/** Publish all staged rows together so a visible mesh is never half updated. */
function publishTerrainChunk(
  terrain: TerrainGeometry,
  writer: TerrainChunkWriter,
): void {
  const { assignment, slot } = writer;
  const positions = slot.positionAttribute.array;

  for (
    let vertexIndex = 0;
    vertexIndex < slot.stagedGroundHeights.length;
    vertexIndex += 1
  ) {
    const positionOffset = vertexIndex * POSITION_COMPONENT_COUNT;
    positions[positionOffset + 1] = slot.stagedGroundHeights[vertexIndex] ?? 0;
  }

  slot.positionAttribute.needsUpdate = true;
  if (slot.zoneConditionsAttribute) {
    slot.zoneConditionsAttribute.needsUpdate = true;
  }

  // PlaneGeometry is centered locally, while assignments describe its corner.
  const halfChunkSize = terrain.chunkSize / 2;
  slot.mesh.position.set(
    assignment.originX + halfChunkSize,
    0,
    assignment.originZ + halfChunkSize,
  );
  slot.mesh.geometry.computeBoundingSphere();
  slot.mesh.visible = true;
}
