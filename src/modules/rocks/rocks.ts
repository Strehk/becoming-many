/**
 * Purpose: Connect zone-driven Rocks to the shared world lifecycle.
 * Context: Fixed instancing must follow the player through an endless landscape.
 * Responsibility: Own chunk assignments, stream jobs, visibility, assets, and cleanup.
 * Boundary: Candidate placement and GPU ranges live in rock-instances.
 */

import type { Scene } from "three";
import {
  disposeGltfAssets,
  type GltfAssets,
} from "../../utils/asset-loader/gltf-assets";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import {
  type ChunkAssignment,
  ChunkWindow,
  getChunkSize,
} from "../../world/chunk-system";
import type { WorldModule } from "../../world/module-runtime";
import type { StreamJob, StreamQueue } from "../../world/stream-queue";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  resolveStaticPopulation,
  type StaticPopulationParameters,
  type StaticPopulationPreset,
} from "../static-population";
import {
  createRockChunkWriter,
  createRockInstances,
  discardRockChunks,
  disposeRockInstances,
  initializeRockChunks,
  type RockInstances,
  uploadRockChanges,
  writeNextRockRow,
} from "./rock-instances";
import { ROCKS_DEFINITION } from "./rocks-definition";

export interface RockColors {
  readonly darkColor: number;
  readonly lightColor: number;
}

export interface RocksPreset extends StaticPopulationPreset {
  readonly colors: RockColors;
}

const ROCK_CHUNK_LEVEL = 2;

export interface RocksModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly preset: RocksPreset;
  readonly assets: GltfAssets;
  readonly streamQueue: StreamQueue;
  readonly worldSurface: WorldSurface;
  readonly effects?: readonly UnlitMaterialEffect[];
}

interface RocksRuntimeOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly parameters: StaticPopulationParameters;
  readonly colors: RockColors;
  readonly assets: GltfAssets;
  readonly streamQueue: StreamQueue;
  readonly worldSurface: WorldSurface;
  readonly effects?: readonly UnlitMaterialEffect[];
}

interface RockStream {
  readonly chunkWindow: ChunkWindow;
  readonly instances: RockInstances;
  readonly slotJobKeys: readonly object[];
}

interface RocksState {
  currentStream: RockStream | undefined;
}

export function createRocksModule(options: RocksModuleOptions): WorldModule {
  const state: RocksState = { currentStream: undefined };
  const runtimeOptions: RocksRuntimeOptions = {
    ...options,
    parameters: resolveStaticPopulation(ROCKS_DEFINITION, options.preset),
    colors: options.preset.colors,
  };

  return {
    load: () => loadRocks(state, runtimeOptions),
    activate: () => setRocksVisible(state, true),
    update: () => updateRocks(state, runtimeOptions),
    deactivate: () => setRocksVisible(state, false),
    unload: () =>
      unloadRocks(state, runtimeOptions.scene, runtimeOptions.assets),
  };
}

function loadRocks(state: RocksState, options: RocksRuntimeOptions): void {
  const stream = createRockStream(options);
  const assignments = stream.chunkWindow.update(
    options.viewpoint.worldPosition.x,
    options.viewpoint.worldPosition.z,
  );

  initializeRockChunks(stream.instances, assignments);
  options.scene.add(stream.instances.modelPool.group);
  state.currentStream = stream;
}

function updateRocks(
  state: RocksState,
  { viewpoint, streamQueue }: RocksRuntimeOptions,
): void {
  const stream = state.currentStream;
  if (!stream) return;
  uploadRockChanges(stream.instances);

  const assignments = stream.chunkWindow.update(
    viewpoint.worldPosition.x,
    viewpoint.worldPosition.z,
  );
  discardRockChunks(stream.instances, assignments);
  uploadRockChanges(stream.instances);
  for (const assignment of assignments) {
    const job = createRockStreamJob(state, stream, assignment);
    if (job) streamQueue.enqueue(job);
  }
}

function createRockStreamJob(
  state: RocksState,
  stream: RockStream,
  assignment: ChunkAssignment,
): StreamJob | undefined {
  const key = stream.slotJobKeys[assignment.slotIndex];
  if (!key) return undefined;
  const writer = createRockChunkWriter(assignment);

  return {
    key,
    isCurrent: () =>
      state.currentStream === stream &&
      stream.chunkWindow.isCurrent(assignment),
    runStep: () => writeNextRockRow(stream.instances, writer),
  };
}

function createRockStream(options: RocksRuntimeOptions): RockStream {
  const chunkSize = getChunkSize(ROCK_CHUNK_LEVEL);
  const radius = Math.max(
    1,
    Math.ceil(options.viewpoint.viewDistanceMeters / chunkSize),
  );
  const chunkWindow = new ChunkWindow({ level: ROCK_CHUNK_LEVEL, radius });
  const instances = createRockInstances({
    parameters: options.parameters,
    colors: options.colors,
    assets: options.assets,
    chunkSize,
    chunkSlotCount: chunkWindow.slotCount,
    worldSurface: options.worldSurface,
    effects: options.effects,
  });
  const slotJobKeys = Array.from({ length: chunkWindow.slotCount }, () => ({}));
  return { chunkWindow, instances, slotJobKeys };
}

function setRocksVisible(state: RocksState, visible: boolean): void {
  const stream = state.currentStream;
  if (stream) stream.instances.modelPool.group.visible = visible;
}

function unloadRocks(
  state: RocksState,
  scene: Scene,
  assets: GltfAssets,
): void {
  const stream = state.currentStream;
  if (!stream) return;

  state.currentStream = undefined;
  scene.remove(stream.instances.modelPool.group);
  disposeRockInstances(stream.instances);
  disposeGltfAssets(assets);
}
