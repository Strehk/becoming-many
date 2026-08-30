/**
 * Purpose: Derive the irregular volume one fly swarm buzzes inside.
 * Context: Real insect clouds are lopsided, have a dense wandering core, and end in stragglers.
 * Responsibility: Own per-swarm anisotropy, the drifting density lobes, and the boundary-free envelope.
 * Boundary: Boid stepping, anchor placement, and rendering stay in the files beside this one.
 */

import { getMotionGaussian, getMotionRandom } from "./motion-random";
import { MOTION_SENSE_SETTINGS } from "./motion-sense-settings";

const COMPONENTS_PER_VALUE = 3;
const TAU = Math.PI * 2;

/** Fixed random channel indexes; the fly streams live in `fly-swarms.ts`. */
const SHAPE_RANDOM_AXIS_X = 20;
const SHAPE_RANDOM_AXIS_Y = 21;
const SHAPE_RANDOM_AXIS_Z = 22;
const SHAPE_RANDOM_YAW = 23;
const LOBE_RANDOM_ANGLE = 24;
const LOBE_RANDOM_OFFSET = 25;
const LOBE_RANDOM_HEIGHT = 26;
const LOBE_RANDOM_SPREAD = 27;
const LOBE_RANDOM_DRIFT_RATE = 28;
const LOBE_RANDOM_DRIFT_PHASE = 29;
const SEED_RANDOM_GAUSSIAN_X = 30;
const SEED_RANDOM_GAUSSIAN_Y = 31;
const SEED_RANDOM_GAUSSIAN_Z = 32;

/** Keeps one swarm's lobe hashes clear of its neighbours' streams. */
const SWARM_LOBE_STRIDE = 977;

/** Seed draws stop near the settled tail, so a cloud starts at its own size. */
const MAX_SEED_SIGMA = 1.8;

/** One drifting density lobe; overlapping lobes make the core lopsided. */
interface SwarmLobe {
  /** Rest offset from the cloud centre, in the shape's own unrotated metres. */
  readonly restX: number;
  readonly restY: number;
  readonly restZ: number;

  /** Gaussian spread of the flies drawn into this lobe, in core radii. */
  readonly spread: number;
  readonly driftMeters: number;
  readonly driftHertz: number;
  readonly driftPhase: number;
}

/** The stretched, tilted, multi-lobed volume of exactly one swarm. */
export interface SwarmShape {
  readonly radiusX: number;
  readonly radiusY: number;
  readonly radiusZ: number;
  readonly yawCos: number;
  readonly yawSin: number;
  readonly lobes: readonly SwarmLobe[];
}

/** A mutable local-metre position written by the sampling helpers. */
export interface LocalPoint {
  x: number;
  y: number;
  z: number;
}

/** Draw one distinct irregular volume per swarm, deterministically. */
export function createSwarmShapes(swarmCount: number): readonly SwarmShape[] {
  return Array.from({ length: swarmCount }, (_, swarmIndex) =>
    createSwarmShape(swarmIndex),
  );
}

function createSwarmShape(swarmIndex: number): SwarmShape {
  const { swarmRadiusMeters, swarmHeightMeters, swarmShape } =
    MOTION_SENSE_SETTINGS;
  const radiusX =
    swarmRadiusMeters * getAxisScale(swarmIndex, SHAPE_RANDOM_AXIS_X);
  const radiusY =
    swarmHeightMeters * getAxisScale(swarmIndex, SHAPE_RANDOM_AXIS_Y);
  const radiusZ =
    swarmRadiusMeters * getAxisScale(swarmIndex, SHAPE_RANDOM_AXIS_Z);
  const yaw = getMotionRandom(swarmIndex, SHAPE_RANDOM_YAW) * TAU;

  return {
    radiusX,
    radiusY,
    radiusZ,
    yawCos: Math.cos(yaw),
    yawSin: Math.sin(yaw),
    lobes: Array.from({ length: swarmShape.lobesPerSwarm }, (_, lobeIndex) =>
      createSwarmLobe(swarmIndex, lobeIndex, radiusX, radiusY, radiusZ),
    ),
  };
}

/** Stretch one axis; the three draws together tilt the cloud out of any box. */
function getAxisScale(swarmIndex: number, channel: number): number {
  const { minAxisScale, maxAxisScale } = MOTION_SENSE_SETTINGS.swarmShape;
  return (
    minAxisScale +
    getMotionRandom(swarmIndex, channel) * (maxAxisScale - minAxisScale)
  );
}

/**
 * Lobes are spaced around the cloud with a jittered angle: they stay balanced
 * around the anchor — so a swarm never drifts off its placement — while no two
 * swarms end up with the same clump layout.
 */
function createSwarmLobe(
  swarmIndex: number,
  lobeIndex: number,
  radiusX: number,
  radiusY: number,
  radiusZ: number,
): SwarmLobe {
  const shape = MOTION_SENSE_SETTINGS.swarmShape;
  const lobeSeed = swarmIndex * SWARM_LOBE_STRIDE + lobeIndex;
  const spacing = lobeIndex / shape.lobesPerSwarm;
  const jitter =
    (getMotionRandom(lobeSeed, LOBE_RANDOM_ANGLE) - 0.5) *
    shape.lobeAngleJitter;
  const angle = (spacing + jitter) * TAU;
  const offset =
    shape.lobeOffsetFraction *
    (0.35 + getMotionRandom(lobeSeed, LOBE_RANDOM_OFFSET) * 0.65);
  const driftRate = MOTION_SENSE_SETTINGS.swarmShape.lobeDriftRate;

  return {
    restX: Math.cos(angle) * offset * radiusX,
    restY:
      (getMotionRandom(lobeSeed, LOBE_RANDOM_HEIGHT) * 2 - 1) *
      offset *
      radiusY,
    restZ: Math.sin(angle) * offset * radiusZ,
    spread:
      shape.minLobeSpread +
      getMotionRandom(lobeSeed, LOBE_RANDOM_SPREAD) *
        (shape.maxLobeSpread - shape.minLobeSpread),
    driftMeters: shape.lobeDriftFraction * radiusX,
    driftHertz:
      driftRate.minHertz +
      getMotionRandom(lobeSeed, LOBE_RANDOM_DRIFT_RATE) *
        (driftRate.maxHertz - driftRate.minHertz),
    driftPhase: getMotionRandom(lobeSeed, LOBE_RANDOM_DRIFT_PHASE) * TAU,
  };
}

/** Total lobe slots behind `writeLobeCentres` for a pool of this many swarms. */
export function getLobeSlotCount(swarmCount: number): number {
  return swarmCount * MOTION_SENSE_SETTINGS.swarmShape.lobesPerSwarm;
}

/** The lobe one fly clumps around, as an index inside its own swarm. */
export function getFlyLobeIndex(flyIndex: number, channel: number): number {
  const { lobesPerSwarm } = MOTION_SENSE_SETTINGS.swarmShape;
  return Math.min(
    lobesPerSwarm - 1,
    Math.floor(getMotionRandom(flyIndex, channel) * lobesPerSwarm),
  );
}

/** Flat slot of one lobe inside the shared `writeLobeCentres` buffer. */
export function getLobeSlot(swarmIndex: number, lobeIndex: number): number {
  return (
    swarmIndex * MOTION_SENSE_SETTINGS.swarmShape.lobesPerSwarm + lobeIndex
  );
}

/**
 * Advance every lobe centre along its own slow wander. Lobes move so the dense
 * part of a cloud keeps reforming somewhere else instead of sitting in a fixed
 * blob; the cost is a handful of sines per swarm, not per fly.
 */
export function writeLobeCentres(
  shapes: readonly SwarmShape[],
  elapsedSeconds: number,
  lobeCentres: Float32Array,
): void {
  const { lobesPerSwarm } = MOTION_SENSE_SETTINGS.swarmShape;

  for (let swarmIndex = 0; swarmIndex < shapes.length; swarmIndex += 1) {
    const shape = shapes[swarmIndex];
    if (!shape) continue;

    for (let lobeIndex = 0; lobeIndex < lobesPerSwarm; lobeIndex += 1) {
      const lobe = shape.lobes[lobeIndex];
      if (!lobe) continue;

      const wander = TAU * lobe.driftHertz * elapsedSeconds + lobe.driftPhase;
      const shapeX = lobe.restX + Math.sin(wander) * lobe.driftMeters;
      const shapeY =
        lobe.restY + Math.sin(wander * 1.31) * lobe.driftMeters * 0.35;
      const shapeZ = lobe.restZ + Math.cos(wander * 0.83) * lobe.driftMeters;
      const slotOffset =
        getLobeSlot(swarmIndex, lobeIndex) * COMPONENTS_PER_VALUE;
      lobeCentres[slotOffset] = shapeX * shape.yawCos - shapeZ * shape.yawSin;
      lobeCentres[slotOffset + 1] = shapeY;
      lobeCentres[slotOffset + 2] =
        shapeX * shape.yawSin + shapeZ * shape.yawCos;
    }
  }
}

/**
 * Seed one fly inside its lobe with a Gaussian draw, which is what gives the
 * cloud a dense centre thinning smoothly outward instead of a filled volume
 * with an edge.
 */
export function sampleSwarmPosition(
  shape: SwarmShape,
  lobeIndex: number,
  flyIndex: number,
  target: LocalPoint,
): void {
  const lobe = shape.lobes[lobeIndex];
  if (!lobe) {
    target.x = 0;
    target.y = 0;
    target.z = 0;
    return;
  }

  const shapeX =
    lobe.restX +
    getSeedOffset(flyIndex, SEED_RANDOM_GAUSSIAN_X) *
      lobe.spread *
      shape.radiusX;
  const shapeY =
    lobe.restY +
    getSeedOffset(flyIndex, SEED_RANDOM_GAUSSIAN_Y) *
      lobe.spread *
      shape.radiusY;
  const shapeZ =
    lobe.restZ +
    getSeedOffset(flyIndex, SEED_RANDOM_GAUSSIAN_Z) *
      lobe.spread *
      shape.radiusZ;
  target.x = shapeX * shape.yawCos - shapeZ * shape.yawSin;
  target.y = shapeY;
  target.z = shapeX * shape.yawSin + shapeZ * shape.yawCos;
}

function getSeedOffset(flyIndex: number, channel: number): number {
  const offset = getMotionGaussian(flyIndex, channel);
  return Math.max(-MAX_SEED_SIGMA, Math.min(MAX_SEED_SIGMA, offset));
}

/**
 * The envelope: a spring that is gentle inside the core and stiffens with the
 * square of the distance outside it. Nothing here is a wall — a fly can always
 * stray out and wander back — but no fly leaves for good either.
 */
export function accumulateEnvelopePull(
  shape: SwarmShape,
  positionX: number,
  positionY: number,
  positionZ: number,
  acceleration: LocalPoint,
): void {
  toShapeSpace(shape, positionX, positionY, positionZ, scratchNormalized);
  const distance = Math.hypot(
    scratchNormalized.x,
    scratchNormalized.y,
    scratchNormalized.z,
  );
  const beyondCore = Math.max(0, distance - 1);
  accumulateShapeSpring(
    shape,
    MOTION_SENSE_SETTINGS.swarmCorePull +
      MOTION_SENSE_SETTINGS.swarmOuterPull * beyondCore * beyondCore,
    acceleration,
  );
}

/**
 * Weak cohesion toward the fly's own density lobe, measured in the same
 * normalized frame so a stretched cloud clumps along its own long axis.
 */
export function accumulateLobePull(
  shape: SwarmShape,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  acceleration: LocalPoint,
): void {
  toShapeSpace(shape, offsetX, offsetY, offsetZ, scratchNormalized);
  accumulateShapeSpring(
    shape,
    MOTION_SENSE_SETTINGS.swarmLobePull,
    acceleration,
  );
}

// One reusable normalized offset keeps the per-fly forces allocation-free.
const scratchNormalized: LocalPoint = { x: 0, y: 0, z: 0 };

/** Express a local-metre offset in the swarm's unrotated, unit-radius frame. */
function toShapeSpace(
  shape: SwarmShape,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  target: LocalPoint,
): void {
  target.x = (offsetX * shape.yawCos + offsetZ * shape.yawSin) / shape.radiusX;
  target.y = offsetY / shape.radiusY;
  target.z = (-offsetX * shape.yawSin + offsetZ * shape.yawCos) / shape.radiusZ;
}

/**
 * Pull back along `scratchNormalized`, the gradient of a spring written in the
 * normalized frame. Dividing by the radius a second time is what makes a wide
 * axis genuinely slack and a shallow one genuinely tight — without it every
 * cloud relaxes into the same size whatever shape it was given.
 */
function accumulateShapeSpring(
  shape: SwarmShape,
  gain: number,
  acceleration: LocalPoint,
): void {
  const forceX = (scratchNormalized.x * gain) / shape.radiusX;
  const forceY = (scratchNormalized.y * gain) / shape.radiusY;
  const forceZ = (scratchNormalized.z * gain) / shape.radiusZ;
  acceleration.x -= forceX * shape.yawCos - forceZ * shape.yawSin;
  acceleration.y -= forceY;
  acceleration.z -= forceX * shape.yawSin + forceZ * shape.yawCos;
}
