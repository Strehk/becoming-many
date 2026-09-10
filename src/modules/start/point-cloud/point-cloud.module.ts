/**
 * Purpose: Connect the Air Particles effect to the shared world lifecycle.
 * Context: A deterministic particle field must follow the player through an endless world.
 * Responsibility: Create the resident volume window and schedule recycled slot updates.
 * Boundary: Buffer data and animation live beside this file; frame budgets live in World.
 */

import type { Scene } from "three";
import { getChunkSize } from "../../../world/chunk-system";
import type { WorldModule } from "../../../world/module-runtime";
import type { StreamJob, StreamQueue } from "../../../world/stream-queue";
import {
  type VolumeChunkAssignment,
  VolumeChunkWindow,
} from "../../../world/volume-chunk-window";
import type { WorldSurface } from "../../../world-surface/world-surface";
import {
  type AirParticleCloud,
  createAirParticleCloud,
  disposeAirParticleCloud,
  initializeAirParticleSlots,
  updateAirParticleSlot,
} from "./point-cloud-geometry";
import {
  AIR_PARTICLES_SETTINGS,
  type AirParticlesParameters,
} from "./point-cloud-settings";

export type {
  AirParticleShape,
  AirParticlesParameters,
} from "./point-cloud-settings";

import type { Viewpoint } from "../../../world/viewpoint";

export interface AirParticlesModuleOptions {
  readonly scene: Scene;
  readonly readPresence?: () => number;
  readonly viewpoint: Viewpoint;
  readonly parameters: AirParticlesParameters;
  readonly streamQueue: StreamQueue;
  readonly surfaceYAt?: WorldSurface["surfaceYAt"];
}

interface AirParticleStream {
  readonly volumeWindow: VolumeChunkWindow;
  readonly particleCloud: AirParticleCloud;

  /** One stable queue key per reusable slot replaces obsolete pending work. */
  readonly slotJobKeys: readonly object[];
}

/** The current stream identity also invalidates delayed jobs after unloading. */
interface AirParticlesState {
  currentStream: AirParticleStream | undefined;
}

export function createAirParticlesModule(
  options: AirParticlesModuleOptions,
): WorldModule {
  const state: AirParticlesState = {
    currentStream: undefined,
  };

  return {
    load: () => loadAirParticles(state, options),
    activate: () => {
      applyPresence(state, options);
      setAirParticlesVisible(state, true);
    },
    update: (deltaSeconds) => {
      applyPresence(state, options);
      updateAirParticles(state, options, deltaSeconds);
    },
    deactivate: () => setAirParticlesVisible(state, false),
    unload: () => unloadAirParticles(state, options.scene),
  };
}

/** Presentation changes opacity only; the resident particle field remains intact. */
function applyPresence(
  state: AirParticlesState,
  options: AirParticlesModuleOptions,
): void {
  if (!options.readPresence || !state.currentStream) return;
  const material = state.currentStream.particleCloud.material.pointsMaterial;
  material.transparent = true;
  material.depthWrite = false;
  material.opacity = options.readPresence();
}

function loadAirParticles(
  state: AirParticlesState,
  options: AirParticlesModuleOptions,
): void {
  const { viewpoint, scene } = options;
  const stream = createAirParticleStream(options);
  state.currentStream = stream;
  const initialAssignments = stream.volumeWindow.update(
    viewpoint.worldPosition.x,
    viewpoint.worldPosition.y,
    viewpoint.worldPosition.z,
  );

  // Loading happens before the first render. Fill every fixed slot now, then
  // keep the object hidden until the module lifecycle activates it.
  initializeAirParticleSlots(stream.particleCloud, initialAssignments);
  stream.particleCloud.points.visible = false;
  scene.add(stream.particleCloud.points);
}

function updateAirParticles(
  state: AirParticlesState,
  { viewpoint, streamQueue }: AirParticlesModuleOptions,
  deltaSeconds: number,
): void {
  const stream = state.currentStream;
  if (!stream) return;

  // Animation changes one uniform only. Particle buffers stay untouched.
  stream.particleCloud.material.update(deltaSeconds);

  const changedAssignments = stream.volumeWindow.update(
    viewpoint.worldPosition.x,
    viewpoint.worldPosition.y,
    viewpoint.worldPosition.z,
  );

  // Most frames return no assignments. After a boundary crossing, only the
  // recycled square face enters the shared frame-budgeted queue.
  for (const assignment of changedAssignments) {
    const job = createVolumeMoveJob(state, stream, assignment);
    if (!job) continue;
    if (streamQueue.enqueue(job)) continue;

    // This small deterministic field is cheap to generate synchronously.
    // Keeping coverage is preferable if the queue reaches defensive capacity.
    updateAirParticleSlot(stream.particleCloud, assignment);
  }
}

function createVolumeMoveJob(
  state: AirParticlesState,
  stream: AirParticleStream,
  assignment: VolumeChunkAssignment,
): StreamJob | undefined {
  const jobKey = stream.slotJobKeys[assignment.slotIndex];
  if (!jobKey) return undefined;

  return {
    key: jobKey,

    // The player may cross another boundary before this job runs. Both checks
    // prevent delayed work from writing into an unloaded or reassigned slot.
    isCurrent: () =>
      state.currentStream === stream &&
      stream.volumeWindow.isCurrent(assignment),

    runStep: () => {
      updateAirParticleSlot(stream.particleCloud, assignment);
      return true;
    },
  };
}

function setAirParticlesVisible(
  state: AirParticlesState,
  visible: boolean,
): void {
  const stream = state.currentStream;
  if (!stream) return;
  stream.particleCloud.points.visible = visible;
}

function unloadAirParticles(state: AirParticlesState, scene: Scene): void {
  const stream = state.currentStream;
  if (!stream) return;

  // Clear the reference first so pending queue jobs immediately become stale.
  state.currentStream = undefined;
  scene.remove(stream.particleCloud.points);
  disposeAirParticleCloud(stream.particleCloud);
}

/** Allocate the fixed resident resources used throughout one loaded lifetime. */
function createAirParticleStream({
  viewpoint,
  parameters,
  surfaceYAt,
}: AirParticlesModuleOptions): AirParticleStream {
  const streaming = parameters.streaming;
  if (
    streaming &&
    (!Number.isFinite(streaming.viewDistanceMeters) ||
      !Number.isFinite(streaming.fadeStartMeters) ||
      streaming.fadeStartMeters < 0 ||
      streaming.viewDistanceMeters <= streaming.fadeStartMeters)
  ) {
    throw new Error(
      "Air particle streaming requires an ordered finite fade range",
    );
  }
  const chunkLevel =
    streaming?.chunkLevel ?? AIR_PARTICLES_SETTINGS.volumeChunkLevel;
  const chunkSize = getChunkSize(chunkLevel);
  const visibleVolumeRadius = Math.ceil(
    (streaming?.viewDistanceMeters ?? viewpoint.viewDistanceMeters) / chunkSize,
  );
  const residentVolumeRadius =
    visibleVolumeRadius + AIR_PARTICLES_SETTINGS.preloadLayerCount;
  const volumeWindow = new VolumeChunkWindow({
    level: chunkLevel,
    radius: residentVolumeRadius,
  });
  const particleCloud = createAirParticleCloud({
    parameters,
    chunkSize,
    chunkSlotCount: volumeWindow.slotCount,
    surfaceYAt,
  });
  const slotJobKeys = Array.from(
    { length: volumeWindow.slotCount },
    () => ({}),
  );

  return { volumeWindow, particleCloud, slotJobKeys };
}
