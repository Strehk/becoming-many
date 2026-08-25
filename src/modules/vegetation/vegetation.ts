/**
 * Purpose: Connect zone-driven Vegetation to the shared world lifecycle.
 * Context: Fixed instancing must follow the player through an endless landscape.
 * Responsibility: Own chunk assignments, stream jobs, visibility, assets, and cleanup.
 * Boundary: Candidate placement and GPU ranges live in vegetation-instances.
 */

import type { PerspectiveCamera, Scene } from "three";
import type { GltfAssets } from "../../utils/asset-loader/gltf-assets";
import { disposeGltfAssets } from "../../utils/asset-loader/gltf-assets";
import {
  type ChunkAssignment,
  ChunkWindow,
  getChunkSize,
} from "../../world/chunk-system";
import type { WorldModule } from "../../world/module-runtime";
import type { StreamJob, StreamQueue } from "../../world/stream-queue";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  resolveStaticPopulation,
  type StaticPopulationParameters,
  type StaticPopulationPreset,
} from "../static-population";
import { VEGETATION_DEFINITION } from "./vegetation-definition";
import {
  createVegetationChunkWriter,
  createVegetationInstances,
  discardVegetationChunks,
  disposeVegetationInstances,
  initializeVegetationChunks,
  uploadVegetationChanges,
  type VegetationInstances,
  writeNextVegetationRow,
} from "./vegetation-instances";

export interface VegetationColors {
  readonly trunkColor: number;
  readonly leafColor: number;
  readonly leafAccentColor: number;
  readonly flowerColor: number;
}

export interface VegetationPreset extends StaticPopulationPreset {
  readonly colors: VegetationColors;
}

const VEGETATION_CHUNK_LEVEL = 2;

export interface VegetationModuleOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly preset: VegetationPreset;
  readonly assets: GltfAssets;
  readonly streamQueue: StreamQueue;
  readonly worldSurface: WorldSurface;
}

interface VegetationRuntimeOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly parameters: StaticPopulationParameters;
  readonly colors: VegetationColors;
  readonly assets: GltfAssets;
  readonly streamQueue: StreamQueue;
  readonly worldSurface: WorldSurface;
}

interface VegetationStream {
  readonly chunkWindow: ChunkWindow;
  readonly instances: VegetationInstances;
  readonly slotJobKeys: readonly object[];
}

interface VegetationState {
  currentStream: VegetationStream | undefined;
}

export function createVegetationModule(
  options: VegetationModuleOptions,
): WorldModule {
  const state: VegetationState = { currentStream: undefined };
  const runtimeOptions: VegetationRuntimeOptions = {
    ...options,
    parameters: resolveStaticPopulation(VEGETATION_DEFINITION, options.preset),
    colors: options.preset.colors,
  };

  return {
    load: () => loadVegetation(state, runtimeOptions),
    activate: () => setVegetationVisible(state, true),
    update: () => updateVegetation(state, runtimeOptions),
    deactivate: () => setVegetationVisible(state, false),
    unload: () =>
      unloadVegetation(state, runtimeOptions.scene, runtimeOptions.assets),
  };
}

function loadVegetation(
  state: VegetationState,
  options: VegetationRuntimeOptions,
): void {
  const stream = createVegetationStream(options);
  const assignments = stream.chunkWindow.update(
    options.camera.position.x,
    options.camera.position.z,
  );

  initializeVegetationChunks(stream.instances, assignments);
  options.scene.add(stream.instances.modelPool.group);
  state.currentStream = stream;
}

function updateVegetation(
  state: VegetationState,
  { camera, streamQueue }: VegetationRuntimeOptions,
): void {
  const stream = state.currentStream;
  if (!stream) return;
  uploadVegetationChanges(stream.instances);

  const assignments = stream.chunkWindow.update(
    camera.position.x,
    camera.position.z,
  );
  discardVegetationChunks(stream.instances, assignments);
  uploadVegetationChanges(stream.instances);
  for (const assignment of assignments) {
    const job = createVegetationStreamJob(state, stream, assignment);
    if (job) streamQueue.enqueue(job);
  }
}

function createVegetationStreamJob(
  state: VegetationState,
  stream: VegetationStream,
  assignment: ChunkAssignment,
): StreamJob | undefined {
  const key = stream.slotJobKeys[assignment.slotIndex];
  if (!key) return undefined;
  const writer = createVegetationChunkWriter(assignment);

  return {
    key,
    isCurrent: () =>
      state.currentStream === stream &&
      stream.chunkWindow.isCurrent(assignment),
    runStep: () => writeNextVegetationRow(stream.instances, writer),
  };
}

function createVegetationStream(
  options: VegetationRuntimeOptions,
): VegetationStream {
  const chunkSize = getChunkSize(VEGETATION_CHUNK_LEVEL);
  const radius = Math.max(1, Math.ceil(options.camera.far / chunkSize));
  const chunkWindow = new ChunkWindow({
    level: VEGETATION_CHUNK_LEVEL,
    radius,
  });
  const instances = createVegetationInstances({
    parameters: options.parameters,
    colors: options.colors,
    assets: options.assets,
    chunkSize,
    chunkSlotCount: chunkWindow.slotCount,
    worldSurface: options.worldSurface,
  });
  const slotJobKeys = Array.from({ length: chunkWindow.slotCount }, () => ({}));
  return { chunkWindow, instances, slotJobKeys };
}

function setVegetationVisible(state: VegetationState, visible: boolean): void {
  const stream = state.currentStream;
  if (stream) stream.instances.modelPool.group.visible = visible;
}

function unloadVegetation(
  state: VegetationState,
  scene: Scene,
  assets: GltfAssets,
): void {
  const stream = state.currentStream;
  if (!stream) return;

  state.currentStream = undefined;
  scene.remove(stream.instances.modelPool.group);
  disposeVegetationInstances(stream.instances);
  disposeGltfAssets(assets);
}
