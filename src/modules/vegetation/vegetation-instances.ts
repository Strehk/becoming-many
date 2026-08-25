/**
 * Purpose: Generate compact, fixed-capacity Vegetation instances by world zone.
 * Context: Endless vegetation must recycle chunks without drawing rejected candidates.
 * Responsibility: Select models, compose transforms, and publish completed chunk slots.
 * Boundary: Loading, chunk selection, scheduling, and lifecycle stay elsewhere.
 */

import { Matrix4, Quaternion, Vector3 } from "three";
import type { GltfAssets } from "../../utils/asset-loader/gltf-assets";
import {
  clearModelSlot,
  commitModelSlot,
  createInstancedModelPool,
  discardCommittedModelSlot,
  disposeInstancedModelPool,
  type InstancedModelPool,
  uploadCommittedModels,
  writeModelInstance,
} from "../../utils/asset-loader/instanced-model-pool";
import {
  applyMaterialEffects,
  type UnlitMaterialEffect,
} from "../../utils/asset-loader/material-effect";
import { createStaticModelAsset } from "../../utils/asset-loader/static-model";
import {
  type ChunkCandidate,
  type ChunkCandidateGrid,
  createChunkCandidateGrid,
  getCellRandom,
} from "../../world/chunk-candidates";
import type { ChunkAssignment } from "../../world/chunk-system";
import type { WorldSurface } from "../../world-surface/world-surface";
import type {
  StaticModelDefinition,
  StaticPopulationParameters,
} from "../static-population";
import {
  selectStaticPlacement,
  validateStaticPopulation,
} from "../static-population";
import type { VegetationColors } from "./vegetation";

const FULL_ROTATION_RADIANS = Math.PI * 2;
const MINIMUM_HORIZONTAL_SCALE = 0.82;
const MAXIMUM_HORIZONTAL_SCALE = 1.18;
const UP_AXIS = new Vector3(0, 1, 0);

interface VegetationInstancesOptions {
  readonly parameters: StaticPopulationParameters;
  readonly colors: VegetationColors;
  readonly assets: GltfAssets;
  readonly chunkSize: number;
  readonly chunkSlotCount: number;
  readonly worldSurface: WorldSurface;
  readonly effects?: readonly UnlitMaterialEffect[];
}

export interface VegetationInstances {
  readonly parameters: StaticPopulationParameters;
  readonly worldSurface: WorldSurface;
  readonly candidateGrid: ChunkCandidateGrid;
  readonly modelPool: InstancedModelPool;
  readonly matrix: Matrix4;
  readonly position: Vector3;
  readonly rotation: Quaternion;
  readonly scale: Vector3;
}

export interface VegetationChunkWriter {
  readonly assignment: ChunkAssignment;
  nextRow: number;
}

export function createVegetationInstances({
  parameters,
  colors,
  assets,
  chunkSize,
  chunkSlotCount,
  worldSurface,
  effects,
}: VegetationInstancesOptions): VegetationInstances {
  validateStaticPopulation(parameters, chunkSize, "Vegetation");
  const candidateGrid = createChunkCandidateGrid(
    chunkSize,
    parameters.candidateSpacingMeters,
  );
  const sources = parameters.assets.map((settings, assetIndex) => ({
    id: settings.id,
    model: createStaticModelAsset(
      getLoadedAsset(assets, settings.id),
      settings.objectName,
      (material) => getVegetationColor(colors, material.name, assetIndex),
    ),
  }));
  if (effects) {
    for (const { model } of sources) {
      for (const part of model.parts) {
        applyMaterialEffects(effects, part.material);
      }
    }
  }
  const modelPool = createInstancedModelPool({
    name: "Vegetation",
    sources,
    slotCount: chunkSlotCount,
    maxInstancesPerSlot: candidateGrid.candidateCount,
  });

  return {
    parameters,
    worldSurface,
    candidateGrid,
    modelPool,
    matrix: new Matrix4(),
    position: new Vector3(),
    rotation: new Quaternion(),
    scale: new Vector3(),
  };
}

function getVegetationColor(
  colors: VegetationColors,
  materialName: string,
  assetIndex: number,
): number {
  if (materialName === "trunk") return colors.trunkColor;
  if (materialName === "flower") return colors.flowerColor;
  return assetIndex % 2 === 0 ? colors.leafColor : colors.leafAccentColor;
}

/** Fill all initial slots before the first frame. */
export function initializeVegetationChunks(
  instances: VegetationInstances,
  assignments: readonly ChunkAssignment[],
): void {
  for (const assignment of assignments) {
    const writer = createVegetationChunkWriter(assignment);
    while (!writeNextVegetationRow(instances, writer)) {
      // Startup is synchronous; recycled chunks use one row per queue step.
    }
  }
  uploadVegetationChanges(instances);
}

export function createVegetationChunkWriter(
  assignment: ChunkAssignment,
): VegetationChunkWriter {
  return { assignment, nextRow: 0 };
}

/** Generate one row and publish the compact model pool after the final row. */
export function writeNextVegetationRow(
  instances: VegetationInstances,
  writer: VegetationChunkWriter,
): boolean {
  if (writer.nextRow === 0) {
    clearModelSlot(instances.modelPool, writer.assignment.slotIndex);
  }
  writeVegetationRow(instances, writer.assignment, writer.nextRow);
  writer.nextRow += 1;
  if (writer.nextRow < instances.candidateGrid.cellsPerSide) return false;

  commitModelSlot(instances.modelPool, writer.assignment.slotIndex);
  return true;
}

/** Upload every completed slot together, once during the next module frame. */
export function uploadVegetationChanges(instances: VegetationInstances): void {
  uploadCommittedModels(instances.modelPool);
}

/** Hide outgoing chunks before Terrain can recycle the ground below them. */
export function discardVegetationChunks(
  instances: VegetationInstances,
  assignments: readonly ChunkAssignment[],
): void {
  for (const assignment of assignments) {
    discardCommittedModelSlot(instances.modelPool, assignment.slotIndex);
  }
}

export function disposeVegetationInstances(
  instances: VegetationInstances,
): void {
  disposeInstancedModelPool(instances.modelPool);
}

function writeVegetationRow(
  instances: VegetationInstances,
  assignment: ChunkAssignment,
  row: number,
): void {
  const firstCandidate = row * instances.candidateGrid.cellsPerSide;
  for (
    let column = 0;
    column < instances.candidateGrid.cellsPerSide;
    column += 1
  ) {
    writeVegetationCandidate(instances, assignment, firstCandidate + column);
  }
}

function writeVegetationCandidate(
  instances: VegetationInstances,
  assignment: ChunkAssignment,
  candidateIndex: number,
): void {
  const placement = selectStaticPlacement(
    instances.parameters,
    instances.candidateGrid,
    instances.worldSurface,
    assignment,
    candidateIndex,
  );
  if (!placement) return;

  writeVegetationTransform(
    instances,
    assignment,
    placement.model,
    placement.candidate,
  );
}

function writeVegetationTransform(
  instances: VegetationInstances,
  assignment: ChunkAssignment,
  settings: StaticModelDefinition,
  candidate: ChunkCandidate,
): void {
  const variant = instances.modelPool.variants.get(settings.id);
  if (!variant) return;
  const height = getModelHeight(instances, settings, candidate);
  const heightScale = height / variant.model.height;
  const widthScale = getHorizontalScale(instances, candidate, 6);
  const depthScale = getHorizontalScale(instances, candidate, 7);
  const footprintRadius =
    variant.model.footprintRadius *
    heightScale *
    Math.max(widthScale, depthScale);
  if (!hasDryFootprint(instances.worldSurface, candidate, footprintRadius)) {
    return;
  }

  const worldY =
    instances.worldSurface.groundYAt(candidate.worldX, candidate.worldZ) -
    variant.model.minimumY * heightScale;

  instances.position.set(candidate.worldX, worldY, candidate.worldZ);
  instances.rotation.setFromAxisAngle(
    UP_AXIS,
    getCellRandom(
      instances.parameters.seed,
      candidate.cellX,
      candidate.cellZ,
      4,
    ) * FULL_ROTATION_RADIANS,
  );
  instances.scale.set(
    heightScale * widthScale,
    heightScale,
    heightScale * depthScale,
  );
  instances.matrix.compose(
    instances.position,
    instances.rotation,
    instances.scale,
  );
  writeModelInstance(
    instances.modelPool,
    settings.id,
    assignment.slotIndex,
    instances.matrix,
  );
}

/** Keep the complete rotated model outside the analytical river channel. */
function hasDryFootprint(
  worldSurface: WorldSurface,
  candidate: ChunkCandidate,
  footprintRadius: number,
): boolean {
  const { riverChannelMarginMeters } = worldSurface.zoneConditionsAt(
    candidate.worldX,
    candidate.worldZ,
  );
  const distanceOutsideRiverMeters = -riverChannelMarginMeters;
  return distanceOutsideRiverMeters >= footprintRadius;
}

function getHorizontalScale(
  instances: VegetationInstances,
  candidate: ChunkCandidate,
  randomValueIndex: number,
): number {
  return mix(
    MINIMUM_HORIZONTAL_SCALE,
    MAXIMUM_HORIZONTAL_SCALE,
    getCellRandom(
      instances.parameters.seed,
      candidate.cellX,
      candidate.cellZ,
      randomValueIndex,
    ),
  );
}

function getModelHeight(
  instances: VegetationInstances,
  settings: StaticModelDefinition,
  candidate: ChunkCandidate,
): number {
  return mix(
    settings.minimumHeightMeters,
    settings.maximumHeightMeters,
    getCellRandom(
      instances.parameters.seed,
      candidate.cellX,
      candidate.cellZ,
      5,
    ),
  );
}

function getLoadedAsset(assets: GltfAssets, assetId: string) {
  const asset = assets.get(assetId);
  if (!asset) throw new Error(`Vegetation asset not loaded: ${assetId}`);
  return asset;
}

function mix(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
