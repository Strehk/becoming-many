/**
 * Purpose: Connect the Scent Particles effect to the shared world lifecycle.
 * Context: Scent radiates from the plants of the streamed world and from live animals.
 * Responsibility: Own the clock, the resident chunk window, and the actor print ring.
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
import {
  getWorldWind,
  type WorldWindSample,
  wrapWindSeconds,
} from "../../world/wind";
import type {
  PlantScentSource,
  ScentActorBody,
  ScentActorObserver,
} from "../scent-sources";
import {
  createScentChunkWriter,
  createScentParticleField,
  disposeScentParticleField,
  initializeScentParticleSlots,
  type ScentParticleField,
  uploadScentParticleSlot,
  writeNextScentStep,
} from "./scent-particle-field";
import type { ScentParticleMaterial } from "./scent-particle-material";
import {
  SCENT_PARTICLES_SETTINGS,
  type ScentParticlesParameters,
} from "./scent-particles-settings";
import {
  createScentTrailField,
  disposeScentTrailField,
  printScentTrail,
  type ScentTrailField,
} from "./scent-trail-field";

export type { ScentParticlesParameters } from "./scent-particles-settings";

export interface ScentParticlesModuleOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly parameters: ScentParticlesParameters;
  readonly streamQueue: StreamQueue;

  /** Omitted by levels that grow no plants; the plant layer then stays away. */
  readonly plantSource?: PlantScentSource;

  /** The actor visibility budget the trail ring is allocated from. */
  readonly maxActorCount?: number;
}

/** The world module plus the sink live actors report their bodies into. */

interface ScentParticleStream {
  readonly chunkWindow: ChunkWindow;
  readonly particleField: ScentParticleField;

  /** One stable queue key per reusable slot replaces obsolete pending work. */
  readonly slotJobKeys: readonly object[];
}

/** The current stream identity also invalidates delayed jobs after unloading. */
interface ScentParticlesState {
  currentStream: ScentParticleStream | undefined;
  trailField: ScentTrailField | undefined;

  /** One looping clock drives both layers, so they drift on the same air. */
  timeSeconds: number;

  /**
   * The wind clock runs separately. The animation clock wraps every 60
   * seconds, and a wind read from it would turn back onto the same bearing
   * just as often, which is the one thing weather must not do.
   */
  windSeconds: number;
  lastDeltaSeconds: number;
  active: boolean;
}

/** The module beside its runtime sense driver. */
/** The module beside its runtime sense driver and its live-actor sink. */
export interface ScentParticlesModuleHandle {
  readonly module: WorldModule;

  /** Drive the sense strength at runtime; scent scales away toward zero. */
  readonly setIntensity: (intensity: number) => void;

  /** Where live actors report the bodies whose routes the trail prints. */
  readonly observeActorBodies: ScentActorObserver;
}

export function createScentParticlesModule(
  options: ScentParticlesModuleOptions,
): ScentParticlesModuleHandle {
  // One fade drives both layers: a show dims the whole sense, not a part.
  const senseFadeUniform = { value: 1 };
  const state: ScentParticlesState = {
    currentStream: undefined,
    trailField: undefined,
    timeSeconds: 0,
    windSeconds: 0,
    lastDeltaSeconds: 0,
    active: false,
  };

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
    observeActorBodies: (bodies) => printActorScent(state, bodies),
  };
}

function loadScentParticles(
  state: ScentParticlesState,
  options: ScentParticlesModuleOptions,
  senseFadeUniform: { readonly value: number },
): void {
  const { camera, scene, parameters, plantSource, maxActorCount } = options;

  if (plantSource) {
    const stream = createScentParticleStream(
      options,
      plantSource,
      senseFadeUniform,
    );
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

  if (parameters.animals && maxActorCount) {
    const trailField = createScentTrailField({
      parameters,
      animals: parameters.animals,
      maxActorCount,
      senseFadeUniform,
    });
    trailField.points.visible = false;
    scene.add(trailField.points);
    state.trailField = trailField;
  }
}

function updateScentParticles(
  state: ScentParticlesState,
  { camera, streamQueue, parameters }: ScentParticlesModuleOptions,
  deltaSeconds: number,
): void {
  // Animation changes two uniforms per layer. Particle buffers stay untouched.
  state.timeSeconds =
    (state.timeSeconds + deltaSeconds * parameters.motion.speedMultiplier) %
    SCENT_PARTICLES_SETTINGS.animationLoopSeconds;
  state.windSeconds = wrapWindSeconds(state.windSeconds + deltaSeconds);
  state.lastDeltaSeconds = deltaSeconds;

  // One wind sample serves both layers, so plant scent and animal trails
  // always lean the same way; each layer scales it by its own authored reach.
  const wind = getWorldWind(state.windSeconds);
  const plantMaterial = state.currentStream?.particleField.material;
  if (plantMaterial) {
    plantMaterial.setTime(state.timeSeconds);
    setLayerWind(plantMaterial, wind, parameters.motion.windResponseMeters);
  }
  const trailMaterial = state.trailField?.material;
  if (trailMaterial && parameters.animals) {
    trailMaterial.setTime(state.timeSeconds);
    setLayerWind(trailMaterial, wind, parameters.animals.windResponseMeters);
  }

  const stream = state.currentStream;
  if (!stream) return;

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

    // Keeping coverage is preferable if the queue reaches defensive capacity.
    writeScentSlotSynchronously(stream.particleField, assignment);
  }
}

/** Carry one layer downwind by its own authored reach. */
function setLayerWind(
  material: ScentParticleMaterial,
  wind: WorldWindSample,
  responseMeters: number,
): void {
  const carried = wind.strength * responseMeters;
  material.setWind(wind.directionX * carried, wind.directionZ * carried);
}

/**
 * Print the scent of the actors that reported this frame. The animals update
 * after this module, so the clock is already the current one.
 */
function printActorScent(
  state: ScentParticlesState,
  bodies: readonly ScentActorBody[],
): void {
  const trailField = state.trailField;
  if (!trailField || !state.active) return;

  printScentTrail(
    trailField,
    bodies,
    state.timeSeconds,
    state.lastDeltaSeconds,
  );
}

function createChunkMoveJob(
  state: ScentParticlesState,
  stream: ScentParticleStream,
  assignment: ChunkAssignment,
): StreamJob | undefined {
  const jobKey = stream.slotJobKeys[assignment.slotIndex];
  if (!jobKey) return undefined;

  // A dense forest chunk holds thousands of particles, so the write is spent
  // in bounded steps and uploaded only once it is complete.
  const writer = createScentChunkWriter(assignment);

  return {
    key: jobKey,

    // The player may cross another boundary before this job runs. Both checks
    // prevent delayed work from writing into an unloaded or reassigned slot.
    isCurrent: () =>
      state.currentStream === stream &&
      stream.chunkWindow.isCurrent(assignment),

    runStep: () => {
      const done = writeNextScentStep(stream.particleField, writer);
      if (done)
        uploadScentParticleSlot(
          stream.particleField,
          writer.assignment.slotIndex,
        );
      return done;
    },
  };
}

/** Spend a whole slot at once; only the queue guard reaches this path. */
function writeScentSlotSynchronously(
  field: ScentParticleField,
  assignment: ChunkAssignment,
): void {
  const writer = createScentChunkWriter(assignment);
  while (!writeNextScentStep(field, writer)) {
    // The bounded steps exist for the frame budget, not for correctness.
  }
  uploadScentParticleSlot(field, assignment.slotIndex);
}

function setScentParticlesVisible(
  state: ScentParticlesState,
  visible: boolean,
): void {
  state.active = visible;
  if (state.currentStream) {
    state.currentStream.particleField.points.visible = visible;
  }
  if (state.trailField) state.trailField.points.visible = visible;
}

function unloadScentParticles(state: ScentParticlesState, scene: Scene): void {
  const stream = state.currentStream;
  const trailField = state.trailField;

  // Clear the references first so pending queue jobs immediately become stale.
  state.currentStream = undefined;
  state.trailField = undefined;
  state.active = false;

  if (stream) {
    scene.remove(stream.particleField.points);
    disposeScentParticleField(stream.particleField);
  }
  if (trailField) {
    scene.remove(trailField.points);
    disposeScentTrailField(trailField);
  }
}

/** Allocate the fixed resident resources used throughout one loaded lifetime. */
function createScentParticleStream(
  { camera, parameters }: ScentParticlesModuleOptions,
  plantSource: PlantScentSource,
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
    plantSource,
    senseFadeUniform,
    chunkSize,
    chunkSlotCount: chunkWindow.slotCount,
  });
  const slotJobKeys = Array.from({ length: chunkWindow.slotCount }, () => ({}));

  return { chunkWindow, particleField, slotJobKeys };
}
