/**
 * Purpose: Connect the grass field to the shared world lifecycle and stream queue.
 * Context: A bounded grass window must follow flight through an endless world.
 * Responsibility: Own chunk assignments, cooperative jobs, visibility, and cleanup.
 * Boundary: Placement buffers and shaders live beside this file; frame budgets live in World.
 */

import type { PerspectiveCamera, Scene } from "three";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import {
  type ChunkAssignment,
  ChunkWindow,
  getChunkSize,
} from "../../world/chunk-system";
import type { WorldModule } from "../../world/module-runtime";
import type { StreamJob, StreamQueue } from "../../world/stream-queue";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  createGrassChunkWriter,
  createGrassField,
  disposeGrassField,
  type GrassField,
  type GrassPreset,
  initializeGrassChunks,
  writeNextGrassRow,
} from "./grass-field";

export type { GrassPreset } from "./grass-field";

// 32-metre chunks let the window hug the camera: grass is only legible close
// up, so a finer grid wastes far less capacity than the 64-metre one.
const GRASS_CHUNK_LEVEL = 1;
const PRELOAD_LAYER_COUNT = 1;
// Grass keeps its own reach instead of following the level view distance.
// Capacity scales with the window area, and thin blades alias into shimmer
// long before this distance anyway, so streaming them to the horizon buys
// nothing and costs everything.
const GRASS_VIEW_DISTANCE_METERS = 64;

export interface GrassModuleOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly preset: GrassPreset;
  readonly streamQueue: StreamQueue;
  readonly worldSurface: WorldSurface;
  readonly effects?: readonly UnlitMaterialEffect[];
}

interface GrassStream {
  readonly chunkWindow: ChunkWindow;
  readonly field: GrassField;
  readonly slotJobKeys: readonly object[];
}

interface GrassState {
  currentStream: GrassStream | undefined;
}

export function createGrassModule(options: GrassModuleOptions): WorldModule {
  const state: GrassState = { currentStream: undefined };

  return {
    load: () => loadGrass(state, options),
    activate: () => setGrassVisible(state, true),
    update: (deltaSeconds) => updateGrass(state, options, deltaSeconds),
    deactivate: () => setGrassVisible(state, false),
    unload: () => unloadGrass(state, options.scene),
  };
}

function loadGrass(state: GrassState, options: GrassModuleOptions): void {
  const stream = createGrassStream(options);
  const initialAssignments = stream.chunkWindow.update(
    options.camera.position.x,
    options.camera.position.z,
  );

  initializeGrassChunks(stream.field, initialAssignments);
  stream.field.mesh.visible = false;
  options.scene.add(stream.field.mesh);
  state.currentStream = stream;
}

function updateGrass(
  state: GrassState,
  { camera, streamQueue }: GrassModuleOptions,
  deltaSeconds: number,
): void {
  const stream = state.currentStream;
  if (!stream) return;

  stream.field.updateAnimation(deltaSeconds);
  const assignments = stream.chunkWindow.update(
    camera.position.x,
    camera.position.z,
  );

  for (const assignment of assignments) {
    const job = createGrassStreamJob(state, stream, assignment);
    if (job) streamQueue.enqueue(job);
  }
}

function createGrassStreamJob(
  state: GrassState,
  stream: GrassStream,
  assignment: ChunkAssignment,
): StreamJob | undefined {
  const key = stream.slotJobKeys[assignment.slotIndex];
  if (!key) return undefined;
  const writer = createGrassChunkWriter(assignment);

  return {
    key,
    isCurrent: () =>
      state.currentStream === stream &&
      stream.chunkWindow.isCurrent(assignment),
    runStep: () => writeNextGrassRow(stream.field, writer),
  };
}

function setGrassVisible(state: GrassState, visible: boolean): void {
  const stream = state.currentStream;
  if (stream) stream.field.mesh.visible = visible;
}

function unloadGrass(state: GrassState, scene: Scene): void {
  const stream = state.currentStream;
  if (!stream) return;

  state.currentStream = undefined;
  scene.remove(stream.field.mesh);
  disposeGrassField(stream.field);
}

function createGrassStream(options: GrassModuleOptions): GrassStream {
  const chunkSize = getChunkSize(GRASS_CHUNK_LEVEL);
  const grassReach = Math.min(options.camera.far, GRASS_VIEW_DISTANCE_METERS);
  const visibleRadius = Math.max(1, Math.ceil(grassReach / chunkSize));
  const chunkWindow = new ChunkWindow({
    level: GRASS_CHUNK_LEVEL,
    radius: visibleRadius + PRELOAD_LAYER_COUNT,
  });
  const field = createGrassField({
    parameters: options.preset,
    chunkSize,
    chunkSlotCount: chunkWindow.slotCount,
    worldSurface: options.worldSurface,
    effects: options.effects,
  });
  const slotJobKeys = Array.from({ length: chunkWindow.slotCount }, () => ({}));

  return { chunkWindow, field, slotJobKeys };
}
