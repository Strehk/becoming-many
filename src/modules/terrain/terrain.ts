/**
 * Purpose: Render a streamed terrain view of the deterministic world surface.
 * Context: Infinite ground heights need a finite recycled Three.js representation.
 * Responsibility: Own one ChunkWindow, fixed mesh pool, cooperative jobs, visibility, and disposal.
 * Boundary: Surface generation, zones, navigation, and frame budgets stay elsewhere.
 */

import type { Scene } from "three";
import {
  type ChunkAssignment,
  ChunkWindow,
  getChunkSize,
} from "../../world/chunk-system";
import type { WorldModule } from "../../world/module-runtime";
import {
  type StreamJob,
  type StreamQueue,
  SURFACE_STREAM_PRIORITY,
} from "../../world/stream-queue";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  createTerrainChunkWriter,
  createTerrainGeometry,
  disposeTerrainGeometry,
  initializeTerrainChunks,
  type TerrainGeometry,
  type TerrainMaterialEffect,
  type TerrainPresentation,
  writeNextTerrainRow,
} from "./terrain-geometry";

// 64-metre chunks keep each generated job bounded while every level can choose
// its own view distance. Crossing one chunk boundary recycles one incoming edge.
const TERRAIN_CHUNK_LEVEL = 2;
const TERRAIN_SEGMENTS_PER_SIDE = 32;

/** Level-controlled presentation values for the persistent terrain geometry. */
export interface TerrainParameters {
  readonly opacity: number;
}

export interface TerrainModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly worldSurface: WorldSurface;
  readonly streamQueue: StreamQueue;
  readonly parameters: TerrainParameters;
  readonly presentation?: TerrainPresentation;
  readonly effects?: readonly TerrainMaterialEffect[];
}

interface TerrainStream {
  readonly chunkWindow: ChunkWindow;
  readonly geometry: TerrainGeometry;
  readonly slotJobKeys: readonly object[];
}

interface TerrainState {
  currentStream: TerrainStream | undefined;
}

export function createTerrainModule(
  options: TerrainModuleOptions,
): WorldModule {
  const state: TerrainState = { currentStream: undefined };

  return {
    load: () => loadTerrain(state, options),
    activate: () => setTerrainVisible(state, true),
    update: (deltaSeconds) => updateTerrain(state, options, deltaSeconds),
    deactivate: () => setTerrainVisible(state, false),
    unload: () => unloadTerrain(state, options.scene),
  };
}

function loadTerrain(state: TerrainState, options: TerrainModuleOptions): void {
  const stream = createTerrainStream(options);
  const initialAssignments = stream.chunkWindow.update(
    options.viewpoint.worldPosition.x,
    options.viewpoint.worldPosition.z,
  );

  initializeTerrainChunks(stream.geometry, initialAssignments);
  stream.geometry.group.visible = false;
  options.scene.add(stream.geometry.group);
  state.currentStream = stream;
}

function updateTerrain(
  state: TerrainState,
  { viewpoint, streamQueue }: TerrainModuleOptions,
  deltaSeconds: number,
): void {
  const stream = state.currentStream;
  if (!stream) return;

  stream.geometry.presentation?.update?.(deltaSeconds);
  for (const effect of stream.geometry.effects) effect.update?.(deltaSeconds);
  const changedAssignments = stream.chunkWindow.update(
    viewpoint.worldPosition.x,
    viewpoint.worldPosition.z,
  );

  enqueueChangedChunks(state, stream, changedAssignments, streamQueue);
}

function enqueueChangedChunks(
  state: TerrainState,
  stream: TerrainStream,
  assignments: readonly ChunkAssignment[],
  streamQueue: StreamQueue,
): void {
  for (const assignment of assignments) {
    const job = createTerrainStreamJob(state, stream, assignment);
    if (!job) continue;

    // The current fixed module set cannot reach the queue's defensive capacity.
    // If that invariant changes, queue sizing is the one place to revisit.
    streamQueue.enqueue(job);
  }
}

function createTerrainStreamJob(
  state: TerrainState,
  stream: TerrainStream,
  assignment: ChunkAssignment,
): StreamJob | undefined {
  const key = stream.slotJobKeys[assignment.slotIndex];
  const writer = createTerrainChunkWriter(stream.geometry, assignment);
  if (!key || !writer) return undefined;

  return {
    key,
    priority: SURFACE_STREAM_PRIORITY,
    isCurrent: () =>
      state.currentStream === stream &&
      stream.chunkWindow.isCurrent(assignment),
    runStep: () => writeNextTerrainRow(stream.geometry, writer),
  };
}

function setTerrainVisible(state: TerrainState, visible: boolean): void {
  const stream = state.currentStream;
  if (stream) stream.geometry.group.visible = visible;
}

function unloadTerrain(state: TerrainState, scene: Scene): void {
  const stream = state.currentStream;
  if (!stream) return;

  // Invalidate queued work before releasing its target geometry.
  state.currentStream = undefined;
  scene.remove(stream.geometry.group);
  disposeTerrainGeometry(stream.geometry);
}

function createTerrainStream(options: TerrainModuleOptions): TerrainStream {
  const chunkSize = getChunkSize(TERRAIN_CHUNK_LEVEL);
  const residentRadius = Math.max(
    1,
    Math.ceil(options.viewpoint.viewDistanceMeters / chunkSize),
  );
  const chunkWindow = new ChunkWindow({
    level: TERRAIN_CHUNK_LEVEL,
    radius: residentRadius,
  });
  const geometry = createTerrainGeometry({
    worldSurface: options.worldSurface,
    chunkSize,
    chunkSlotCount: chunkWindow.slotCount,
    segmentsPerSide:
      options.presentation?.segmentsPerSide ?? TERRAIN_SEGMENTS_PER_SIDE,
    opacity: options.parameters.opacity,
    presentation: options.presentation,
    effects: options.effects,
  });
  const slotJobKeys = Array.from({ length: chunkWindow.slotCount }, () => ({}));

  return { chunkWindow, geometry, slotJobKeys };
}
