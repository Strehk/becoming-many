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
import {
  MOTION_SENSE_SETTINGS,
  type MotionSenseParameters,
} from "./motion-sense-settings";

const COMPONENTS_PER_VALUE = 3;
const RANDOM_VALUE_RANGE = 0x1_0000_0000;
const TAU = Math.PI * 2;

/** Fixed random channel indexes keeping every hash stream independent. */
const FLY_RANDOM_SCATTER_ANGLE = 0;
const FLY_RANDOM_SCATTER_RADIUS = 1;
const FLY_RANDOM_SCATTER_HEIGHT = 2;
const FLY_RANDOM_VELOCITY_ANGLE = 3;
const FLY_RANDOM_SPEED = 4;
const FLY_RANDOM_PHASE = 5;
const FLY_RANDOM_FREQUENCY = 6;
const FLY_RANDOM_STRENGTH = 7;
const ANCHOR_RANDOM_ANGLE = 8;
const ANCHOR_RANDOM_RADIUS = 9;

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
}

interface SwarmAnchor {
  x: number;
  y: number;
  z: number;
}

export interface FlySwarms {
  readonly points: Points<BufferGeometry, PointsMaterial>;

  /** Tightly packed world xyz triples of every fly; stable array identity. */
  readonly getWorldPositions: () => Float32Array;
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
  const anchors: SwarmAnchor[] = Array.from({ length: swarmCount }, () => ({
    x: 0,
    y: 0,
    z: 0,
  }));
  const anchorOrigin = { x: options.initialPlayerX, z: options.initialPlayerZ };
  let anchorEpoch = 0;
  let elapsedSeconds = 0;

  initializeFlies(options, {
    localPositions,
    velocities,
    phases,
    frequencies,
    strengths,
  });
  placeAnchors(options, anchors, anchorEpoch, anchorOrigin.x, anchorOrigin.z);

  const positionAttribute = new BufferAttribute(
    worldPositions,
    COMPONENTS_PER_VALUE,
  );
  positionAttribute.setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positionAttribute);
  const points = new Points(
    geometry,
    createFlySwarmMaterial(parameters.appearance),
  );

  // The pool follows the traveling player, so its bounds change every frame.
  // Skipping object-level culling keeps all swarms in one stable draw.
  points.frustumCulled = false;

  const state = {
    localPositions,
    velocities,
    worldPositions,
    phases,
    frequencies,
    strengths,
    anchors,
  };
  writeWorldPositions(options, state, positionAttribute);

  return {
    points,
    getWorldPositions: () => worldPositions,
    update: (deltaSeconds, playerX, playerZ) => {
      const movedX = playerX - anchorOrigin.x;
      const movedZ = playerZ - anchorOrigin.z;
      const reanchorDistance = MOTION_SENSE_SETTINGS.reanchorDistanceMeters;
      if (movedX * movedX + movedZ * movedZ > reanchorDistance ** 2) {
        anchorEpoch += 1;
        anchorOrigin.x = playerX;
        anchorOrigin.z = playerZ;
        placeAnchors(options, anchors, anchorEpoch, playerX, playerZ);
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
}

interface SwarmState extends FlyBuffers {
  readonly worldPositions: Float32Array;
  readonly anchors: readonly SwarmAnchor[];
}

/** Seed every fly's scatter, velocity, and buzz character deterministically. */
function initializeFlies(
  { parameters }: FlySwarmsOptions,
  buffers: FlyBuffers,
): void {
  const { swarmCount, fliesPerSwarm, flightSpeedMultiplier } =
    parameters.swarms;
  const speedScale = Math.max(0, flightSpeedMultiplier);

  for (let flyIndex = 0; flyIndex < swarmCount * fliesPerSwarm; flyIndex += 1) {
    const valueOffset = flyIndex * COMPONENTS_PER_VALUE;
    const scatterAngle =
      getMotionRandom(flyIndex, FLY_RANDOM_SCATTER_ANGLE) * TAU;
    const scatterRadius =
      Math.sqrt(getMotionRandom(flyIndex, FLY_RANDOM_SCATTER_RADIUS)) *
      MOTION_SENSE_SETTINGS.swarmRadiusMeters;
    buffers.localPositions[valueOffset] =
      Math.cos(scatterAngle) * scatterRadius;
    buffers.localPositions[valueOffset + 1] =
      (getMotionRandom(flyIndex, FLY_RANDOM_SCATTER_HEIGHT) * 2 - 1) *
      MOTION_SENSE_SETTINGS.swarmHeightMeters;
    buffers.localPositions[valueOffset + 2] =
      Math.sin(scatterAngle) * scatterRadius;

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

/**
 * Place every swarm anchor on its player-centred ring. A bounded candidate
 * search rejects water; when every candidate misses, the last one still
 * anchors the swarm so coverage never silently drops.
 */
function placeAnchors(
  options: FlySwarmsOptions,
  anchors: readonly SwarmAnchor[],
  epoch: number,
  playerX: number,
  playerZ: number,
): void {
  for (let swarmIndex = 0; swarmIndex < anchors.length; swarmIndex += 1) {
    const anchor = anchors[swarmIndex];
    if (!anchor) continue;

    const ring = getSwarmRing(swarmIndex, anchors.length);
    for (
      let attempt = 0;
      attempt < MOTION_SENSE_SETTINGS.placementAttemptsPerAnchor;
      attempt += 1
    ) {
      const angle =
        getMotionRandom(swarmIndex, ANCHOR_RANDOM_ANGLE, epoch, attempt) * TAU;
      const radius =
        ring.minMeters +
        Math.sqrt(
          getMotionRandom(swarmIndex, ANCHOR_RANDOM_RADIUS, epoch, attempt),
        ) *
          (ring.maxMeters - ring.minMeters);
      anchor.x = playerX + Math.cos(angle) * radius;
      anchor.z = playerZ + Math.sin(angle) * radius;
      if (options.zoneAt(anchor.x, anchor.z) !== "water") break;
    }
    anchor.y =
      options.groundYAt(anchor.x, anchor.z) +
      MOTION_SENSE_SETTINGS.groundClearanceMeters;
  }
}

/** The distance ring for one swarm, interpolated near to far across the pool. */
function getSwarmRing(
  swarmIndex: number,
  swarmCount: number,
): { readonly minMeters: number; readonly maxMeters: number } {
  const { nearRing, farRing } = MOTION_SENSE_SETTINGS;
  const mix = swarmCount <= 1 ? 0 : swarmIndex / (swarmCount - 1);
  return {
    minMeters:
      nearRing.minMeters + (farRing.minMeters - nearRing.minMeters) * mix,
    maxMeters:
      nearRing.maxMeters + (farRing.maxMeters - nearRing.maxMeters) * mix,
  };
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

  for (let swarmIndex = 0; swarmIndex < state.anchors.length; swarmIndex += 1) {
    const swarmStart = swarmIndex * pace.fliesPerSwarm;
    for (let localIndex = 0; localIndex < pace.fliesPerSwarm; localIndex += 1) {
      stepFly(state, pace, swarmStart, localIndex);
    }
  }
}

function stepFly(
  state: SwarmState,
  pace: BoidPace,
  swarmStart: number,
  localIndex: number,
): void {
  const flyIndex = swarmStart + localIndex;
  const valueOffset = flyIndex * COMPONENTS_PER_VALUE;
  const positionX = state.localPositions[valueOffset] ?? 0;
  const positionY = state.localPositions[valueOffset + 1] ?? 0;
  const positionZ = state.localPositions[valueOffset + 2] ?? 0;

  accumulateBuzzJitter(state, pace, flyIndex, positionY);
  accumulateFlockmateForces(
    state,
    pace,
    swarmStart,
    localIndex,
    positionX,
    positionY,
    positionZ,
  );
  accumulateEnvelopePull(positionX, positionY, positionZ);
  clampAccelerationForce();
  applyIntegrationStep(
    state,
    pace,
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
  positionY: number,
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
    getSignedNoise(flyIndex, 1, noiseStep) * 3.2 * strength - positionY * 0.8;
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

/** The soft envelope pulls far-strayed flies back toward the cloud. */
function accumulateEnvelopePull(
  positionX: number,
  positionY: number,
  positionZ: number,
): void {
  if (
    Math.hypot(positionX, positionZ) > MOTION_SENSE_SETTINGS.swarmRadiusMeters
  ) {
    scratchAcceleration.x -= positionX * 4;
    scratchAcceleration.z -= positionZ * 4;
  }
  if (Math.abs(positionY) > MOTION_SENSE_SETTINGS.swarmHeightMeters) {
    scratchAcceleration.y -= positionY * 5;
  }
}

function clampAccelerationForce(): void {
  const force = Math.hypot(
    scratchAcceleration.x,
    scratchAcceleration.y,
    scratchAcceleration.z,
  );
  if (force <= MOTION_SENSE_SETTINGS.maxForce) return;

  const forceScale = MOTION_SENSE_SETTINGS.maxForce / force;
  scratchAcceleration.x *= forceScale;
  scratchAcceleration.y *= forceScale;
  scratchAcceleration.z *= forceScale;
}

/** Integrate the accumulated acceleration, clamp speed, and bounce off ground. */
function applyIntegrationStep(
  state: SwarmState,
  pace: BoidPace,
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
  const speed = Math.hypot(nextVelocityX, nextVelocityY, nextVelocityZ);
  const targetSpeed = Math.min(pace.maxSpeed, Math.max(pace.minSpeed, speed));
  if (speed > 0.0001) {
    const velocityScale = targetSpeed / speed;
    nextVelocityX *= velocityScale;
    nextVelocityY *= velocityScale;
    nextVelocityZ *= velocityScale;
  }

  // The soft envelope shapes the cloud; this hard clamp is what guarantees
  // numerical overshoot never sends a fly below the ground.
  const heightLimit = MOTION_SENSE_SETTINGS.swarmHeightMeters;
  const proposedY = positionY + nextVelocityY * pace.stepSeconds;
  const nextY = Math.min(heightLimit, Math.max(pace.minLocalY, proposedY));
  if (proposedY < pace.minLocalY) {
    nextVelocityY = Math.abs(nextVelocityY) * GROUND_BOUNCE_DAMPING;
  } else if (proposedY > heightLimit) {
    nextVelocityY = -Math.abs(nextVelocityY) * GROUND_BOUNCE_DAMPING;
  }

  state.velocities[valueOffset] = nextVelocityX;
  state.velocities[valueOffset + 1] = nextVelocityY;
  state.velocities[valueOffset + 2] = nextVelocityZ;
  state.localPositions[valueOffset] =
    positionX + nextVelocityX * pace.stepSeconds;
  state.localPositions[valueOffset + 1] = nextY;
  state.localPositions[valueOffset + 2] =
    positionZ + nextVelocityZ * pace.stepSeconds;
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

    const groundedY =
      options.groundYAt(anchor.x, anchor.z) +
      MOTION_SENSE_SETTINGS.groundClearanceMeters;
    anchor.y +=
      (groundedY - anchor.y) * MOTION_SENSE_SETTINGS.anchorGroundFollowRate;

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

/**
 * Return one stable pseudo-random value in [0, 1) without keeping RNG state.
 * Fly-level values leave epoch and attempt at zero; anchor candidates use them.
 */
function getMotionRandom(
  index: number,
  channel: number,
  epoch = 0,
  attempt = 0,
): number {
  let hash = Math.imul(index + 1, 73_856_093);
  hash ^= Math.imul(channel + 1, 19_349_663);
  hash ^= Math.imul(epoch + 1, 2_971_215_073);
  hash ^= Math.imul(attempt + 1, 83_492_791);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);

  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}

/** Stable stepped noise in [-1, 1) for the abrupt per-fly buzz jitter. */
function getSignedNoise(index: number, channel: number, step: number): number {
  let hash =
    Math.imul(index + 1, 374_761_393) ^
    Math.imul(channel + 1, 668_265_263) ^
    Math.imul(step + 1, 1_274_126_177);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x7fff_ffff - 1;
}
