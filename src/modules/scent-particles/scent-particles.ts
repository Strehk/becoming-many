/**
 * Purpose: Connect the Scent Particles effect to the shared world lifecycle.
 * Context: Deterministic scent sources must appear throughout the endless world while traveling.
 * Responsibility: Create the resident chunk window and schedule recycled slot updates.
 * Boundary: Buffer data and animation live beside this file; frame budgets live in World.
 */

import type { PerspectiveCamera, Scene } from "three";
import {
  type ChunkAssignment,
  ChunkWindow,
  getChunkSize,
} from "../../world/chunk-system";
import type { WorldModule } from "../../world/module-runtime";
import type { StreamJob, StreamQueue } from "../../world/stream-queue";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  createScentParticleField,
  disposeScentParticleField,
  initializeScentParticleSlots,
  type ScentParticleField,
  updateScentParticleSlot,
} from "./scent-particle-field";
import {
  SCENT_PARTICLES_SETTINGS,
  type ScentParticlesParameters,
} from "./scent-particles-settings";

export type { ScentParticlesParameters } from "./scent-particles-settings";

export interface ScentParticlesModuleOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly parameters: ScentParticlesParameters;
  readonly streamQueue: StreamQueue;
  readonly groundYAt: WorldSurface["groundYAt"];
  readonly zoneAt: WorldSurface["zoneAt"];
}

interface ScentParticleStream {
  readonly chunkWindow: ChunkWindow;
  readonly particleField: ScentParticleField;

  /** One stable queue key per reusable slot replaces obsolete pending work. */
  readonly slotJobKeys: readonly object[];
}

/** The current stream identity also invalidates delayed jobs after unloading. */
interface ScentParticlesState {
  currentStream: ScentParticleStream | undefined;
}

/** The module beside its runtime sense driver. */
export interface ScentParticlesModuleHandle {
  readonly module: WorldModule;
  /** Drive the sense strength at runtime; puffs scale away toward zero. */
  readonly setIntensity: (intensity: number) => void;
}

export function createScentParticlesModule(
  options: ScentParticlesModuleOptions,
): ScentParticlesModuleHandle {
  const senseFadeUniform = { value: 1 };
  const state: ScentParticlesState = { currentStream: undefined };

  return {
    module: {
      load: () => loadScentParticles(state, options, senseFadeUniform),
      activate: () => setScentParticlesVisible(state, true),
      update: (deltaSeconds) =>
        updateScentParticles(state, options, deltaSeconds),
      deactivate: () => setScentParticlesVisible(state, false),
      unload: () => unloadScentParticles(state, options.scene),
    },
    setIntensity: (intensity) => {
      senseFadeUniform.value = intensity;
    },
  };
}

function loadScentParticles(
  state: ScentParticlesState,
  options: ScentParticlesModuleOptions,
  senseFadeUniform: { readonly value: number },
): void {
  const { camera, scene } = options;
  const stream = createScentParticleStream(options, senseFadeUniform);
  const initialAssignments = stream.chunkWindow.update(
    camera.position.x,
    camera.position.z,
  );

  // Loading happens before the first render. Fill every fixed slot now, then
  // keep the object hidden until the module lifecycle activates it.
  initializeScentParticleSlots(stream.particleField, initialAssignments);
  stream.particleField.points.visible = false;
  scene.add(stream.particleField.points);
  state.currentStream = stream;
}

function updateScentParticles(
  state: ScentParticlesState,
  { camera, streamQueue }: ScentParticlesModuleOptions,
  deltaSeconds: number,
): void {
  const stream = state.currentStream;
  if (!stream) return;

  // Animation changes one uniform only. Particle buffers stay untouched.
  stream.particleField.material.update(deltaSeconds);

  const changedAssignments = stream.chunkWindow.update(
    camera.position.x,
    camera.position.z,
  );

  // Most frames return no assignments. After a boundary crossing, only the
  // recycled edge enters the shared frame-budgeted queue.
  for (const assignment of changedAssignments) {
    const job = createChunkMoveJob(state, stream, assignment);
    if (!job) continue;
    if (streamQueue.enqueue(job)) continue;

    // This small deterministic field is cheap to generate synchronously.
    // Keeping coverage is preferable if the queue reaches defensive capacity.
    updateScentParticleSlot(stream.particleField, assignment);
  }
}

function createChunkMoveJob(
  state: ScentParticlesState,
  stream: ScentParticleStream,
  assignment: ChunkAssignment,
): StreamJob | undefined {
  const jobKey = stream.slotJobKeys[assignment.slotIndex];
  if (!jobKey) return undefined;

  return {
    key: jobKey,

    // The player may cross another boundary before this job runs. Both checks
    // prevent delayed work from writing into an unloaded or reassigned slot.
    isCurrent: () =>
      state.currentStream === stream &&
      stream.chunkWindow.isCurrent(assignment),

    runStep: () => {
      updateScentParticleSlot(stream.particleField, assignment);
      return true;
    },
  };
}

function setScentParticlesVisible(
  state: ScentParticlesState,
  visible: boolean,
): void {
  const stream = state.currentStream;
  if (!stream) return;

  stream.particleField.points.visible = visible;
}

function unloadScentParticles(state: ScentParticlesState, scene: Scene): void {
  const stream = state.currentStream;
  if (!stream) return;

  // Clear the reference first so pending queue jobs immediately become stale.
  state.currentStream = undefined;
  scene.remove(stream.particleField.points);
  disposeScentParticleField(stream.particleField);
}

/** Allocate the fixed resident resources used throughout one loaded lifetime. */
function createScentParticleStream(
  { camera, parameters, groundYAt, zoneAt }: ScentParticlesModuleOptions,
  senseFadeUniform: { readonly value: number },
): ScentParticleStream {
  const chunkSize = getChunkSize(SCENT_PARTICLES_SETTINGS.chunkLevel);
  const visibleChunkRadius = Math.ceil(camera.far / chunkSize);
  const residentChunkRadius =
    visibleChunkRadius + SCENT_PARTICLES_SETTINGS.preloadLayerCount;
  const chunkWindow = new ChunkWindow({
    level: SCENT_PARTICLES_SETTINGS.chunkLevel,
    radius: residentChunkRadius,
  });
  const particleField = createScentParticleField({
    parameters,
    senseFadeUniform,
    chunkSize,
    chunkSlotCount: chunkWindow.slotCount,
    groundYAt,
    zoneAt,
  });
  const slotJobKeys = Array.from({ length: chunkWindow.slotCount }, () => ({}));

  return { chunkWindow, particleField, slotJobKeys };
}
