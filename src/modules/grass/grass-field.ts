/**
 * Purpose: Store and render the fixed-capacity streamed grass field.
 * Context: Infinite grass must reuse bounded GPU buffers while following the camera.
 * Responsibility: Own tuft topology, instance ranges, deterministic placement, animation, and disposal.
 * Boundary: Chunk selection, queue scheduling, module lifecycle, and world-surface rules stay elsewhere.
 */

import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Vector2,
} from "three";
import type { ChunkAssignment } from "../../world/chunk-system";
import { WORLD_WIND } from "../../world/wind";
import type { WorldSurface } from "../../world-surface/world-surface";
import type { ZoneId } from "../../world-surface/zone-settings";
import fragmentShader from "./grass.frag.glsl?raw";
import vertexShader from "./grass.vert.glsl?raw";

const INSTANCE_COMPONENT_COUNT = 4;
const TUFT_WIDTH_TO_HEIGHT_RATIO = 0.32;
const RANDOM_VALUE_RANGE = 0x1_0000_0000;
const HIDDEN_SEED = -1;
const SHRUB_SLOPE_SEED_OFFSET = 1;
const ANIMATION_LOOP_SECONDS = 60;

export type GrassZoneId = "meadow" | "shrubSlope";

export interface GrassZonePreset {
  readonly tuftsPerSquareMeter: number;
  readonly bladeHeightMeters: number;
}

export interface GrassPreset {
  readonly rootColor: number;
  readonly tipColor: number;
  readonly zones: Partial<Record<GrassZoneId, GrassZonePreset>>;
}

interface GrassFieldOptions {
  readonly parameters: GrassPreset;
  readonly chunkSize: number;
  readonly chunkSlotCount: number;
  readonly worldSurface: WorldSurface;
}

export interface GrassField {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  readonly parameters: GrassPreset;
  readonly chunkSize: number;
  readonly maximumTuftsPerSquareMeter: number;
  readonly tuftsPerSide: number;
  readonly tuftsPerChunk: number;
  readonly valuesPerChunk: number;
  readonly worldSurface: WorldSurface;
  readonly renderedInstances: Float32Array;
  readonly instanceAttribute: InstancedBufferAttribute;
  readonly updateAnimation: (deltaSeconds: number) => void;
}

export interface GrassChunkWriter {
  readonly assignment: ChunkAssignment;
  nextRow: number;
}

/** Allocate one mesh and one fixed instance range for every reusable chunk slot. */
export function createGrassField({
  parameters,
  chunkSize,
  chunkSlotCount,
  worldSurface,
}: GrassFieldOptions): GrassField {
  validateGrassParameters(parameters);
  const maximumTuftsPerSquareMeter = getMaximumGrassDensity(parameters);
  const tuftsPerSide = Math.max(
    1,
    Math.round(chunkSize * Math.sqrt(maximumTuftsPerSquareMeter)),
  );
  const tuftsPerChunk = tuftsPerSide ** 2;
  const valuesPerChunk = tuftsPerChunk * INSTANCE_COMPONENT_COUNT;
  const renderedInstances = new Float32Array(valuesPerChunk * chunkSlotCount);
  const instanceAttribute = new InstancedBufferAttribute(
    renderedInstances,
    INSTANCE_COMPONENT_COUNT,
  );
  instanceAttribute.setUsage(DynamicDrawUsage);

  const geometry = createTuftGeometry(
    instanceAttribute,
    tuftsPerChunk,
    chunkSlotCount,
  );
  const material = createGrassMaterial(parameters);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.name = "grass-field";

  return {
    mesh,
    parameters,
    chunkSize,
    maximumTuftsPerSquareMeter,
    tuftsPerSide,
    tuftsPerChunk,
    valuesPerChunk,
    worldSurface,
    renderedInstances,
    instanceAttribute,
    updateAnimation: (deltaSeconds) => {
      const time = material.uniforms.grassTime;
      if (!time) return;
      time.value = (Number(time.value) + deltaSeconds) % ANIMATION_LOOP_SECONDS;
    },
  };
}

/** Fill initial slots before Three.js uploads the attribute for the first time. */
export function initializeGrassChunks(
  field: GrassField,
  assignments: readonly ChunkAssignment[],
): void {
  for (const assignment of assignments) {
    const writer = createGrassChunkWriter(assignment);
    while (!writeNextGrassRow(field, writer)) {
      // Initial loading is synchronous; streamed replacements use one row per step.
    }
  }

  field.instanceAttribute.clearUpdateRanges();
}

export function createGrassChunkWriter(
  assignment: ChunkAssignment,
): GrassChunkWriter {
  return { assignment, nextRow: 0 };
}

/** Write one candidate row and publish the slot only after the final row. */
export function writeNextGrassRow(
  field: GrassField,
  writer: GrassChunkWriter,
): boolean {
  writeGrassRow(field, writer.assignment, writer.nextRow);
  writer.nextRow += 1;

  if (writer.nextRow < field.tuftsPerSide) return false;

  publishGrassChunk(field, writer.assignment);
  return true;
}

export function disposeGrassField(field: GrassField): void {
  field.mesh.geometry.dispose();
  field.mesh.material.dispose();
}

function createTuftGeometry(
  instanceAttribute: InstancedBufferAttribute,
  tuftsPerChunk: number,
  chunkSlotCount: number,
): InstancedBufferGeometry {
  const halfWidth = TUFT_WIDTH_TO_HEIGHT_RATIO * 0.5;
  const positions = [
    -halfWidth,
    0,
    0,
    halfWidth,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    -halfWidth,
    0,
    0,
    halfWidth,
    0,
    1,
    0,
  ];
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("grassInstance", instanceAttribute);
  geometry.instanceCount = tuftsPerChunk * chunkSlotCount;
  return geometry;
}

function createGrassMaterial(parameters: GrassPreset): ShaderMaterial {
  const meadowHeight = parameters.zones.meadow?.bladeHeightMeters;
  const shrubSlopeHeight = parameters.zones.shrubSlope?.bladeHeightMeters;
  const baseHeight = meadowHeight ?? shrubSlopeHeight ?? 1;

  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: DoubleSide,
    uniforms: {
      grassTime: { value: 0 },
      grassMeadowHeight: { value: baseHeight },
      grassShrubSlopeHeightScale: {
        value: (shrubSlopeHeight ?? baseHeight) / baseHeight,
      },
      grassWindDirection: { value: new Vector2(...WORLD_WIND.directionXZ) },
      grassWindStrength: { value: WORLD_WIND.strength },
      grassWindSpeed: { value: WORLD_WIND.speed },
      grassRootColor: { value: new Color(parameters.rootColor) },
      grassTipColor: { value: new Color(parameters.tipColor) },
    },
  });
}

function writeGrassRow(
  field: GrassField,
  assignment: ChunkAssignment,
  row: number,
): void {
  for (let column = 0; column < field.tuftsPerSide; column += 1) {
    writeGrassCandidate(field, assignment, column, row);
  }
}

function writeGrassCandidate(
  field: GrassField,
  assignment: ChunkAssignment,
  column: number,
  row: number,
): void {
  const spacing = field.chunkSize / field.tuftsPerSide;
  const globalCellX = assignment.chunkX * field.tuftsPerSide + column;
  const globalCellZ = assignment.chunkZ * field.tuftsPerSide + row;
  const seed = getGrassRandom(globalCellX, globalCellZ, 0);
  const jitterX = getGrassRandom(globalCellX, globalCellZ, 1) - 0.5;
  const jitterZ = getGrassRandom(globalCellX, globalCellZ, 2) - 0.5;
  const worldX = assignment.originX + (column + 0.5 + jitterX * 0.7) * spacing;
  const worldZ = assignment.originZ + (row + 0.5 + jitterZ * 0.7) * spacing;
  const worldY = field.worldSurface.groundYAt(worldX, worldZ);
  const zone = field.worldSurface.zoneAt(worldX, worldZ);
  const instanceIndex =
    assignment.slotIndex * field.tuftsPerChunk +
    row * field.tuftsPerSide +
    column;
  const valueOffset = instanceIndex * INSTANCE_COMPONENT_COUNT;

  field.renderedInstances[valueOffset] = worldX;
  field.renderedInstances[valueOffset + 1] = worldY;
  field.renderedInstances[valueOffset + 2] = worldZ;
  field.renderedInstances[valueOffset + 3] = encodeGrassSeed(
    field,
    zone,
    seed,
    globalCellX,
    globalCellZ,
  );
}

function encodeGrassSeed(
  field: GrassField,
  zone: ZoneId,
  seed: number,
  globalCellX: number,
  globalCellZ: number,
): number {
  const zonePreset = getGrassZonePreset(field.parameters, zone);
  if (!zonePreset) return HIDDEN_SEED;

  const densityRatio =
    zonePreset.tuftsPerSquareMeter / field.maximumTuftsPerSquareMeter;
  const densityRandom = getGrassRandom(globalCellX, globalCellZ, 3);
  if (densityRandom >= densityRatio) return HIDDEN_SEED;

  switch (zone) {
    case "meadow":
      return seed;
    case "shrubSlope":
      return seed + SHRUB_SLOPE_SEED_OFFSET;
    case "water":
    case "coniferForest":
    case "deciduousForest":
      return HIDDEN_SEED;
  }
}

function getGrassZonePreset(
  parameters: GrassPreset,
  zone: ZoneId,
): GrassZonePreset | undefined {
  if (zone === "meadow" || zone === "shrubSlope") {
    return parameters.zones[zone];
  }

  return undefined;
}

function publishGrassChunk(
  field: GrassField,
  assignment: ChunkAssignment,
): void {
  field.instanceAttribute.addUpdateRange(
    assignment.slotIndex * field.valuesPerChunk,
    field.valuesPerChunk,
  );
  field.instanceAttribute.needsUpdate = true;
}

/** Stable integer-cell hash; revisiting a world cell recreates the same tuft. */
function getGrassRandom(
  globalCellX: number,
  globalCellZ: number,
  valueIndex: number,
): number {
  let hash = Math.imul(globalCellX, 73_856_093);
  hash ^= Math.imul(globalCellZ, 19_349_663);
  hash ^= Math.imul(valueIndex + 1, 83_492_791);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);
  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}

function validateGrassParameters(parameters: GrassPreset): void {
  const configuredZones = Object.entries(parameters.zones) as Array<
    [GrassZoneId, GrassZonePreset]
  >;
  if (configuredZones.length === 0) {
    throw new Error("Grass requires at least one configured zone");
  }

  for (const [zoneId, zone] of configuredZones) {
    validatePositiveFinite(zone.tuftsPerSquareMeter, `${zoneId} grass density`);
    validatePositiveFinite(zone.bladeHeightMeters, `${zoneId} grass height`);
  }

  const meadowHeight = parameters.zones.meadow?.bladeHeightMeters;
  const shrubSlopeHeight = parameters.zones.shrubSlope?.bladeHeightMeters;
  if (
    meadowHeight !== undefined &&
    shrubSlopeHeight !== undefined &&
    shrubSlopeHeight > meadowHeight
  ) {
    throw new RangeError(
      "Shrub-slope grass must be no taller than meadow grass",
    );
  }
}

function getMaximumGrassDensity(parameters: GrassPreset): number {
  return Math.max(
    ...Object.values(parameters.zones).map(
      ({ tuftsPerSquareMeter }) => tuftsPerSquareMeter,
    ),
  );
}

function validatePositiveFinite(value: number, name: string): void {
  if (Number.isFinite(value) && value > 0) return;
  throw new RangeError(`${name} must be a positive finite number`);
}
