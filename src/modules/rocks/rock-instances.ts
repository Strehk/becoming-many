/**
 * Purpose: Generate compact, fixed-capacity Rock instances by world zone.
 * Context: Endless rocks must recycle chunks without drawing rejected candidates.
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
import type { RockColors } from "./rocks";

const FULL_ROTATION_RADIANS = Math.PI * 2;
const UP_AXIS = new Vector3(0, 1, 0);

interface RockInstancesOptions {
  readonly parameters: StaticPopulationParameters;
  readonly colors: RockColors;
  readonly assets: GltfAssets;
  readonly chunkSize: number;
  readonly chunkSlotCount: number;
  readonly worldSurface: WorldSurface;
  readonly effects?: readonly UnlitMaterialEffect[];
}

export interface RockInstances {
  readonly parameters: StaticPopulationParameters;
  readonly worldSurface: WorldSurface;
  readonly candidateGrid: ChunkCandidateGrid;
  readonly modelPool: InstancedModelPool;
  readonly matrix: Matrix4;
  readonly position: Vector3;
  readonly rotation: Quaternion;
  readonly scale: Vector3;
}

export interface RockChunkWriter {
  readonly assignment: ChunkAssignment;
  nextRow: number;
}

export function createRockInstances({
  parameters,
  colors,
  assets,
  chunkSize,
  chunkSlotCount,
  worldSurface,
  effects,
}: RockInstancesOptions): RockInstances {
  validateStaticPopulation(parameters, chunkSize, "Rock");
  const candidateGrid = createChunkCandidateGrid(
    chunkSize,
    parameters.candidateSpacingMeters,
  );
  const sources = parameters.assets.map((settings, assetIndex) => ({
    id: settings.id,
    model: createStaticModelAsset(
      getLoadedAsset(assets, settings.id),
      settings.objectName,
      (material) => getRockColor(colors, material.name, assetIndex),
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
    name: "Rocks",
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

function getRockColor(
  colors: RockColors,
  materialName: string,
  assetIndex: number,
): number {
  if (materialName === "light") return colors.lightColor;
  if (materialName === "dark") return colors.darkColor;
  return assetIndex % 2 === 0 ? colors.darkColor : colors.lightColor;
}

export function initializeRockChunks(
  instances: RockInstances,
  assignments: readonly ChunkAssignment[],
): void {
  for (const assignment of assignments) {
    const writer = createRockChunkWriter(assignment);
    while (!writeNextRockRow(instances, writer)) {
      // Startup is synchronous; recycled chunks use one row per queue step.
    }
  }
  uploadRockChanges(instances);
}

export function createRockChunkWriter(
  assignment: ChunkAssignment,
): RockChunkWriter {
  return { assignment, nextRow: 0 };
}

export function writeNextRockRow(
  instances: RockInstances,
  writer: RockChunkWriter,
): boolean {
  if (writer.nextRow === 0) {
    clearModelSlot(instances.modelPool, writer.assignment.slotIndex);
  }
  writeRockRow(instances, writer.assignment, writer.nextRow);
  writer.nextRow += 1;
  if (writer.nextRow < instances.candidateGrid.cellsPerSide) return false;

  commitModelSlot(instances.modelPool, writer.assignment.slotIndex);
  return true;
}

/** Upload every completed slot together, once during the next module frame. */
export function uploadRockChanges(instances: RockInstances): void {
  uploadCommittedModels(instances.modelPool);
}

/** Hide outgoing chunks before Terrain can recycle the ground below them. */
export function discardRockChunks(
  instances: RockInstances,
  assignments: readonly ChunkAssignment[],
): void {
  for (const assignment of assignments) {
    discardCommittedModelSlot(instances.modelPool, assignment.slotIndex);
  }
}

export function disposeRockInstances(instances: RockInstances): void {
  disposeInstancedModelPool(instances.modelPool);
}

function writeRockRow(
  instances: RockInstances,
  assignment: ChunkAssignment,
  row: number,
): void {
  const firstCandidate = row * instances.candidateGrid.cellsPerSide;
  for (
    let column = 0;
    column < instances.candidateGrid.cellsPerSide;
    column += 1
  ) {
    writeRockCandidate(instances, assignment, firstCandidate + column);
  }
}

function writeRockCandidate(
  instances: RockInstances,
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

  writeRockTransform(
    instances,
    assignment,
    placement.model,
    placement.candidate,
  );
}

function writeRockTransform(
  instances: RockInstances,
  assignment: ChunkAssignment,
  settings: StaticModelDefinition,
  candidate: ChunkCandidate,
): void {
  const variant = instances.modelPool.variants.get(settings.id);
  if (!variant) return;
  const height = getModelHeight(instances, settings, candidate);
  const scale = height / variant.model.height;
  const worldY =
    instances.worldSurface.groundYAt(candidate.worldX, candidate.worldZ) -
    variant.model.minimumY * scale;

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
  instances.scale.setScalar(scale);
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

function getModelHeight(
  instances: RockInstances,
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
  if (!asset) throw new Error(`Rock asset not loaded: ${assetId}`);
  return asset;
}

function mix(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
