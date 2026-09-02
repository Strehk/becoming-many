/**
 * Purpose: Simulate and render the persistent ambient fly swarms.
 * Context: Ground-near fly clouds occupy player-centred distance rings while traveling.
 * Responsibility: Own deterministic placement, the buzzing boid integration, and the fly point pool.
 * Boundary: Trail printing, materials' shader patches, and module lifecycle stay elsewhere.
 */

import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Points,
  type PointsMaterial,
} from "three";
import type { WorldSurface } from "../../world-surface/world-surface";
import { createFlySwarmMaterial } from "./fly-swarm-material";
import { getMotionRandom, getSignedNoise } from "./motion-random";
import {
  MOTION_SENSE_SETTINGS,
  type MotionSenseParameters,
} from "./motion-sense-settings";
import {
  createSwarmAnchors,
  placeSwarmAnchors,
  type SwarmAnchor,
  settleAnchorGround,
} from "./swarm-anchors";
import {
  accumulateEnvelopePull,
  accumulateLobePull,
  createSwarmShapes,
  getFlyBinding,
  getFlyLobeIndex,
  getLobeSlot,
  getLobeSlotCount,
  type LocalPoint,
  type SwarmShape,
  sampleSwarmPosition,
  writeLobeCentres,
} from "./swarm-shape";

const COMPONENTS_PER_VALUE = 3;
const TAU = Math.PI * 2;

/** Fixed random channel indexes keeping every hash stream independent. */
const FLY_RANDOM_LOBE = 0;
const FLY_RANDOM_BINDING = 1;
const FLY_RANDOM_VELOCITY_ANGLE = 3;
const FLY_RANDOM_SPEED = 4;
const FLY_RANDOM_PHASE = 5;
const FLY_RANDOM_FREQUENCY = 6;
const FLY_RANDOM_STRENGTH = 7;

/** Buzz character ranges ported from the proven bm-base swarm feel. */
const MIN_BUZZ_FREQUENCY = 12;
const BUZZ_FREQUENCY_RANGE = 16;
const MIN_BUZZ_STRENGTH = 0.8;
const BUZZ_STRENGTH_RANGE = 0.9;
const NOISE_STEP_RATE = 1.25;
const GROUND_BOUNCE_MARGIN_METERS = 0.18;
const GROUND_BOUNCE_DAMPING = 0.35;

interface FlySwarmsOptions {
  readonly parameters: MotionSenseParameters;
  readonly groundYAt: WorldSurface["groundYAt"];
  readonly zoneAt: WorldSurface["zoneAt"];
  readonly initialPlayerX: number;
  readonly initialPlayerZ: number;
  /** Shared with the module handle; a show fades the sense through it. */
  readonly senseFadeUniform?: { readonly value: number };
}

export interface FlySwarms {
  readonly points: Points<BufferGeometry, PointsMaterial>;

  /** Tightly packed world xyz triples of every fly; stable array identity. */
  readonly getWorldPositions: () => Float32Array;

  /**
   * Tightly packed world xyz triples, one per swarm: where the cloud sits,
   * rather than where its flies are. Spatial audio places a sound on the
   * nearest swarm through this; stable identity, refreshed on read.
   */
  readonly readSwarmCenters: () => Float32Array;
  readonly update: (
    deltaSeconds: number,
    playerX: number,
    playerZ: number,
  ) => void;
  readonly dispose: () => void;
}

/** Allocate the fixed fly pool and place every swarm around the start pose. */
export function createFlySwarms(options: FlySwarmsOptions): FlySwarms {
  const { parameters } = options;
  const { swarmCount, fliesPerSwarm } = parameters.swarms;
  const flyCount = swarmCount * fliesPerSwarm;
  const localPositions = new Float32Array(flyCount * COMPONENTS_PER_VALUE);
  const velocities = new Float32Array(flyCount * COMPONENTS_PER_VALUE);
  const worldPositions = new Float32Array(flyCount * COMPONENTS_PER_VALUE);
  const phases = new Float32Array(flyCount);
  const frequencies = new Float32Array(flyCount);
  const strengths = new Float32Array(flyCount);
  const lobeSlots = new Int32Array(flyCount);
  const bindings = new Float32Array(flyCount);
  const shapes = createSwarmShapes(swarmCount);
  const lobeCentres = new Float32Array(
    getLobeSlotCount(swarmCount) * COMPONENTS_PER_VALUE,
  );
  const anchors: readonly SwarmAnchor[] = createSwarmAnchors(swarmCount);
  const swarmCenters = new Float32Array(swarmCount * COMPONENTS_PER_VALUE);
  const anchorOrigin = { x: options.initialPlayerX, z: options.initialPlayerZ };
  let anchorEpoch = 0;
  let elapsedSeconds = 0;

  initializeFlies(options, shapes, {
    localPositions,
    velocities,
    phases,
    frequencies,
    strengths,
    lobeSlots,
    bindings,
  });
  placeSwarmAnchors(
    anchors,
    options,
    anchorEpoch,
    anchorOrigin.x,
    anchorOrigin.z,
  );

  const positionAttribute = new BufferAttribute(
    worldPositions,
    COMPONENTS_PER_VALUE,
  );
  positionAttribute.setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positionAttribute);
  const points = new Points(
    geometry,
    createFlySwarmMaterial(parameters.appearance, options.senseFadeUniform),
  );

  // The pool follows the traveling player, so its bounds change every frame.
  // Skipping object-level culling keeps all swarms in one stable draw.
  points.frustumCulled = false;

  const state: SwarmState = {
    localPositions,
    velocities,
    worldPositions,
    phases,
    frequencies,
    strengths,
    lobeSlots,
    bindings,
    lobeCentres,
    shapes,
    anchors,
  };
  writeWorldPositions(options, state, positionAttribute);

  return {
    points,
    getWorldPositions: () => worldPositions,
    readSwarmCenters: () => {
      // Anchors settle toward the ground as the world streams under them, so
      // the centres are copied on read rather than kept in step from afar.
      anchors.forEach((anchor, index) => {
        const offset = index * COMPONENTS_PER_VALUE;
        swarmCenters[offset] = anchor.x;
        swarmCenters[offset + 1] = anchor.y;
        swarmCenters[offset + 2] = anchor.z;
      });
      return swarmCenters;
    },
    update: (deltaSeconds, playerX, playerZ) => {
      const movedX = playerX - anchorOrigin.x;
      const movedZ = playerZ - anchorOrigin.z;
      const reanchorDistance = MOTION_SENSE_SETTINGS.reanchorDistanceMeters;
      if (movedX * movedX + movedZ * movedZ > reanchorDistance ** 2) {
        anchorEpoch += 1;
        anchorOrigin.x = playerX;
        anchorOrigin.z = playerZ;
        placeSwarmAnchors(anchors, options, anchorEpoch, playerX, playerZ);
        writeWorldPositions(options, state, positionAttribute);
      }
      if (deltaSeconds <= 0) return;

      elapsedSeconds += deltaSeconds;
      integrateBoids(options, state, deltaSeconds, elapsedSeconds);
      writeWorldPositions(options, state, positionAttribute);
    },
    dispose: () => {
      geometry.dispose();
      points.material.dispose();
    },
  };
}

interface FlyBuffers {
  readonly localPositions: Float32Array;
  readonly velocities: Float32Array;
  readonly phases: Float32Array;
  readonly frequencies: Float32Array;
  readonly strengths: Float32Array;

  /** The density lobe each fly clumps around, as a flat slot index. */
  readonly lobeSlots: Int32Array;

  /** How tightly the swarm holds each fly; the loose ones are the wanderers. */
  readonly bindings: Float32Array;
}

interface SwarmState extends FlyBuffers {
  readonly worldPositions: Float32Array;

  /** Local xyz of every lobe centre, rewritten once per integration pass. */
  readonly lobeCentres: Float32Array;
  readonly shapes: readonly SwarmShape[];
  readonly anchors: readonly SwarmAnchor[];
}

/** Seed every fly's scatter, velocity, and buzz character deterministically. */
function initializeFlies(
  { parameters }: FlySwarmsOptions,
  shapes: readonly SwarmShape[],
  buffers: FlyBuffers,
): void {
  const { swarmCount, fliesPerSwarm, flightSpeedMultiplier } =
    parameters.swarms;
  const speedScale = Math.max(0, flightSpeedMultiplier);
  const seed: LocalPoint = { x: 0, y: 0, z: 0 };

  for (let flyIndex = 0; flyIndex < swarmCount * fliesPerSwarm; flyIndex += 1) {
    const valueOffset = flyIndex * COMPONENTS_PER_VALUE;
    const swarmIndex = Math.floor(flyIndex / fliesPerSwarm);
    const shape = shapes[swarmIndex];
    const lobeIndex = getFlyLobeIndex(flyIndex, FLY_RANDOM_LOBE);
    const binding = getFlyBinding(flyIndex, FLY_RANDOM_BINDING);
    buffers.lobeSlots[flyIndex] = getLobeSlot(swarmIndex, lobeIndex);
    buffers.bindings[flyIndex] = binding;
    seed.x = 0;
    seed.y = 0;
    seed.z = 0;
    if (shape) {
      sampleSwarmPosition(shape, lobeIndex, flyIndex, binding, seed);
    }
    buffers.localPositions[valueOffset] = seed.x;
    buffers.localPositions[valueOffset + 1] = seed.y;
    buffers.localPositions[valueOffset + 2] = seed.z;

    const velocityAngle =
      getMotionRandom(flyIndex, FLY_RANDOM_VELOCITY_ANGLE) * TAU;
    const speed =
      (MOTION_SENSE_SETTINGS.minFlightSpeed +
        getMotionRandom(flyIndex, FLY_RANDOM_SPEED) *
          (MOTION_SENSE_SETTINGS.maxFlightSpeed -
            MOTION_SENSE_SETTINGS.minFlightSpeed)) *
      speedScale;
    buffers.velocities[valueOffset] = Math.cos(velocityAngle) * speed;
    buffers.velocities[valueOffset + 1] =
      (getMotionRandom(flyIndex, FLY_RANDOM_SPEED) - 0.5) * speed;
    buffers.velocities[valueOffset + 2] = Math.sin(velocityAngle) * speed;
    buffers.phases[flyIndex] =
      getMotionRandom(flyIndex, FLY_RANDOM_PHASE) * TAU;
    buffers.frequencies[flyIndex] =
      MIN_BUZZ_FREQUENCY +
      getMotionRandom(flyIndex, FLY_RANDOM_FREQUENCY) * BUZZ_FREQUENCY_RANGE;
    buffers.strengths[flyIndex] =
      MIN_BUZZ_STRENGTH +
      getMotionRandom(flyIndex, FLY_RANDOM_STRENGTH) * BUZZ_STRENGTH_RANGE;
  }
}

/** Shared per-frame pacing values for one boid integration pass. */
interface BoidPace {
  readonly fliesPerSwarm: number;
  readonly speedScale: number;
  readonly stepSeconds: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly minLocalY: number;
  readonly elapsedSeconds: number;
}

// One reusable accumulator keeps the hot loop free of per-fly allocations.
const scratchAcceleration = { x: 0, y: 0, z: 0 };

/**
 * One buzzing boid step per fly, ported from the proven bm-base integration:
 * stepped hash noise, strided flockmate sampling, a soft envelope, and a hard
 * ground bounce that guarantees no fly ever sinks below its clearance.
 */
function integrateBoids(
  { parameters }: FlySwarmsOptions,
  state: SwarmState,
  deltaSeconds: number,
  elapsedSeconds: number,
): void {
  const settings = MOTION_SENSE_SETTINGS;
  const speedScale = Math.max(0, parameters.swarms.flightSpeedMultiplier);
  const pace: BoidPace = {
    fliesPerSwarm: parameters.swarms.fliesPerSwarm,
    speedScale,
    stepSeconds: Math.min(deltaSeconds, settings.maxBoidStepSeconds),
    minSpeed: settings.minFlightSpeed * speedScale,
    maxSpeed: settings.maxFlightSpeed * speedScale,
    minLocalY: -settings.groundClearanceMeters + GROUND_BOUNCE_MARGIN_METERS,
    elapsedSeconds,
  };

  writeLobeCentres(state.shapes, elapsedSeconds, state.lobeCentres);
  for (let swarmIndex = 0; swarmIndex < state.anchors.length; swarmIndex += 1) {
    const shape = state.shapes[swarmIndex];
    const anchor = state.anchors[swarmIndex];
    if (!shape || !anchor) continue;

    const swarmStart = swarmIndex * pace.fliesPerSwarm;
    for (let localIndex = 0; localIndex < pace.fliesPerSwarm; localIndex += 1) {
      stepFly(state, pace, shape, anchor, swarmStart, localIndex);
    }
  }
}

function stepFly(
  state: SwarmState,
  pace: BoidPace,
  shape: SwarmShape,
  anchor: SwarmAnchor,
  swarmStart: number,
  localIndex: number,
): void {
  const flyIndex = swarmStart + localIndex;
  const valueOffset = flyIndex * COMPONENTS_PER_VALUE;
  const positionX = state.localPositions[valueOffset] ?? 0;
  const positionY = state.localPositions[valueOffset + 1] ?? 0;
  const positionZ = state.localPositions[valueOffset + 2] ?? 0;

  accumulateBuzzJitter(state, pace, flyIndex);
  accumulateFlockmateForces(
    state,
    pace,
    swarmStart,
    localIndex,
    positionX,
    positionY,
    positionZ,
  );
  accumulateFlyLobePull(
    state,
    shape,
    flyIndex,
    positionX,
    positionY,
    positionZ,
  );
  accumulateEnvelopePull(
    shape,
    state.bindings[flyIndex] ?? 1,
    positionX,
    positionY,
    positionZ,
    scratchAcceleration,
  );
  clampAccelerationForce();
  applyIntegrationStep(
    state,
    pace,
    anchor,
    valueOffset,
    positionX,
    positionY,
    positionZ,
  );
}

/**
 * Stepped hash noise gives the abrupt insect jitter without becoming
 * frame-rate-dependent or allocating random state in the hot loop.
 */
function accumulateBuzzJitter(
  state: SwarmState,
  pace: BoidPace,
  flyIndex: number,
): void {
  const buzzTime =
    pace.elapsedSeconds *
      (state.frequencies[flyIndex] ?? 18) *
      pace.speedScale +
    (state.phases[flyIndex] ?? 0);
  const noiseStep = Math.floor(buzzTime * NOISE_STEP_RATE);
  const strength = state.strengths[flyIndex] ?? 1;

  scratchAcceleration.x =
    getSignedNoise(flyIndex, 0, noiseStep) * 4.5 * strength;
  scratchAcceleration.y =
    getSignedNoise(flyIndex, 1, noiseStep) * 3.2 * strength;
  scratchAcceleration.z =
    getSignedNoise(flyIndex, 2, noiseStep) * 4.5 * strength;
}

/** Strided flockmate samples bound the cost regardless of swarm size. */
function accumulateFlockmateForces(
  state: SwarmState,
  pace: BoidPace,
  swarmStart: number,
  localIndex: number,
  positionX: number,
  positionY: number,
  positionZ: number,
): void {
  const samples = Math.min(
    MOTION_SENSE_SETTINGS.neighbourSamples,
    pace.fliesPerSwarm - 1,
  );

  for (let sample = 0; sample < samples; sample += 1) {
    const otherLocal = (localIndex + 1 + sample * 31) % pace.fliesPerSwarm;
    const otherOffset = (swarmStart + otherLocal) * COMPONENTS_PER_VALUE;
    const otherX = state.localPositions[otherOffset] ?? 0;
    const otherY = state.localPositions[otherOffset + 1] ?? 0;
    const otherZ = state.localPositions[otherOffset + 2] ?? 0;
    const separationX = positionX - otherX;
    const separationY = positionY - otherY;
    const separationZ = positionZ - otherZ;
    const distanceSq =
      separationX * separationX +
      separationY * separationY +
      separationZ * separationZ;
    if (distanceSq < 0.025 && distanceSq > 0.000001) {
      const push = 0.025 / distanceSq;
      scratchAcceleration.x += separationX * push;
      scratchAcceleration.y += separationY * push;
      scratchAcceleration.z += separationZ * push;
    }
    if (distanceSq < 0.8) {
      scratchAcceleration.x += (otherX - positionX) * 0.025;
      scratchAcceleration.y += (otherY - positionY) * 0.018;
      scratchAcceleration.z += (otherZ - positionZ) * 0.025;
    }
  }
}

/**
 * Weak cohesion toward the fly's own density lobe. It is what keeps the cloud
 * clumpy and uneven as the lobes wander, without ever pinning a fly in place.
 */
function accumulateFlyLobePull(
  state: SwarmState,
  shape: SwarmShape,
  flyIndex: number,
  positionX: number,
  positionY: number,
  positionZ: number,
): void {
  const lobeOffset = (state.lobeSlots[flyIndex] ?? 0) * COMPONENTS_PER_VALUE;
  accumulateLobePull(
    shape,
    positionX - (state.lobeCentres[lobeOffset] ?? 0),
    positionY - (state.lobeCentres[lobeOffset + 1] ?? 0),
    positionZ - (state.lobeCentres[lobeOffset + 2] ?? 0),
    scratchAcceleration,
  );
}

function clampAccelerationForce(): void {
  // Comparing squares keeps the root off the common path; the clamp engages on
  // a fraction of a percent of fly-steps, so nearly every fly skips it.
  const forceSq =
    scratchAcceleration.x * scratchAcceleration.x +
    scratchAcceleration.y * scratchAcceleration.y +
    scratchAcceleration.z * scratchAcceleration.z;
  if (forceSq <= MOTION_SENSE_SETTINGS.maxForce ** 2) return;

  const forceScale = MOTION_SENSE_SETTINGS.maxForce / Math.sqrt(forceSq);
  scratchAcceleration.x *= forceScale;
  scratchAcceleration.y *= forceScale;
  scratchAcceleration.z *= forceScale;
}

/** Integrate the accumulated acceleration, clamp speed, and bounce off ground. */
function applyIntegrationStep(
  state: SwarmState,
  pace: BoidPace,
  anchor: SwarmAnchor,
  valueOffset: number,
  positionX: number,
  positionY: number,
  positionZ: number,
): void {
  let nextVelocityX =
    (state.velocities[valueOffset] ?? 0) +
    scratchAcceleration.x * pace.stepSeconds;
  let nextVelocityY =
    (state.velocities[valueOffset + 1] ?? 0) +
    scratchAcceleration.y * pace.stepSeconds;
  let nextVelocityZ =
    (state.velocities[valueOffset + 2] ?? 0) +
    scratchAcceleration.z * pace.stepSeconds;
  const speed = Math.sqrt(
    nextVelocityX * nextVelocityX +
      nextVelocityY * nextVelocityY +
      nextVelocityZ * nextVelocityZ,
  );
  const targetSpeed = Math.min(pace.maxSpeed, Math.max(pace.minSpeed, speed));
  if (speed > 0.0001) {
    const velocityScale = targetSpeed / speed;
    nextVelocityX *= velocityScale;
    nextVelocityY *= velocityScale;
    nextVelocityZ *= velocityScale;
  }

  // The ground is the one real surface a fly can meet, so it is the only hard
  // clamp left: it guarantees numerical overshoot never sinks a fly into the
  // terrain. Upward there is nothing to hit, and the envelope alone decides how
  // far a straggler gets before it drifts back. The floor tilts with the
  // anchor's ground plane, so a stray metres out over a slope rides the hill
  // instead of holding the height that was right back at the anchor.
  const nextX = positionX + nextVelocityX * pace.stepSeconds;
  const nextZ = positionZ + nextVelocityZ * pace.stepSeconds;
  const localFloorY =
    pace.minLocalY + anchor.groundSlopeX * nextX + anchor.groundSlopeZ * nextZ;
  const proposedY = positionY + nextVelocityY * pace.stepSeconds;
  const nextY = Math.max(localFloorY, proposedY);
  if (proposedY < localFloorY) {
    nextVelocityY = Math.abs(nextVelocityY) * GROUND_BOUNCE_DAMPING;
  }

  state.velocities[valueOffset] = nextVelocityX;
  state.velocities[valueOffset + 1] = nextVelocityY;
  state.velocities[valueOffset + 2] = nextVelocityZ;
  state.localPositions[valueOffset] = nextX;
  state.localPositions[valueOffset + 1] = nextY;
  state.localPositions[valueOffset + 2] = nextZ;
}

/** Settle anchors onto the ground, compose world positions, and upload them. */
function writeWorldPositions(
  options: FlySwarmsOptions,
  state: SwarmState,
  positionAttribute: BufferAttribute,
): void {
  const { fliesPerSwarm } = options.parameters.swarms;

  for (let swarmIndex = 0; swarmIndex < state.anchors.length; swarmIndex += 1) {
    const anchor = state.anchors[swarmIndex];
    if (!anchor) continue;

    settleAnchorGround(anchor, options.groundYAt);

    const swarmStart = swarmIndex * fliesPerSwarm;
    for (let localIndex = 0; localIndex < fliesPerSwarm; localIndex += 1) {
      const valueOffset = (swarmStart + localIndex) * COMPONENTS_PER_VALUE;
      state.worldPositions[valueOffset] =
        anchor.x + (state.localPositions[valueOffset] ?? 0);
      state.worldPositions[valueOffset + 1] =
        anchor.y + (state.localPositions[valueOffset + 1] ?? 0);
      state.worldPositions[valueOffset + 2] =
        anchor.z + (state.localPositions[valueOffset + 2] ?? 0);
    }
  }

  positionAttribute.addUpdateRange(0, state.worldPositions.length);
  positionAttribute.needsUpdate = true;
}
