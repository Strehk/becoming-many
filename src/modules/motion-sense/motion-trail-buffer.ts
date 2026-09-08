/**
 * Purpose: Store and render the Motion Trail particle ring buffer.
 * Context: One trail particle prints per moving point per frame; older prints age GPU-only.
 * Responsibility: Own the fixed ring buffers, newest-slot writes, thinning, uploads, and disposal.
 * Boundary: Fly simulation, materials' shader patches, and module lifecycle stay elsewhere.
 */

import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Points,
  type PointsMaterial,
} from "three";
import {
  MOTION_SENSE_SETTINGS,
  type MotionSenseParameters,
  type MotionTrailAppearance,
} from "./motion-sense-settings";
import { createMotionTrailMaterial } from "./motion-trail-material";

const COMPONENTS_PER_VALUE = 3;

interface MotionTrailBufferOptions {
  /** Fixed number of tracked points; every frame prints one slot of this size. */
  readonly pointCount: number;
  readonly trail: MotionSenseParameters["trail"];
  readonly appearance: MotionTrailAppearance;
  readonly intensity: number;
  /** Shared with the module handle; a show fades the sense through it. */
  readonly senseFadeUniform?: { readonly value: number };
}

/**
 * A ring of `lifetimeFrames` slots, each holding one particle per tracked
 * point. Every spawn overwrites the oldest slot; all other slots keep their
 * immutable spawn-time values and animate from the frame uniform alone.
 */
export interface MotionTrailBuffer {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  readonly spawnFromWorldPoints: (worldPositions: Float32Array) => void;
  /**
   * Drop the memory of where the tracked points last were. A source that goes
   * away and comes back somewhere else has no continuity with its own past,
   * and without this its return prints one frame of enormous movement — a
   * bright streak across everything between the two places.
   */
  readonly forgetHistory: () => void;
  readonly dispose: () => void;
}

/** Allocate the one fixed-capacity trail object used for the loaded lifetime. */
export function createMotionTrailBuffer({
  pointCount,
  trail,
  appearance,
  intensity,
  senseFadeUniform,
}: MotionTrailBufferOptions): MotionTrailBuffer {
  const capacity = pointCount * trail.lifetimeFrames;
  const printedPositions = new Float32Array(capacity * COMPONENTS_PER_VALUE);
  const expansionDirections = new Float32Array(capacity * COMPONENTS_PER_VALUE);
  const spawnIntensities = new Float32Array(capacity);
  const spawnFrames = new Float32Array(capacity);
  const positionAttribute = createDynamicAttribute(
    printedPositions,
    COMPONENTS_PER_VALUE,
  );
  const directionAttribute = createDynamicAttribute(
    expansionDirections,
    COMPONENTS_PER_VALUE,
  );
  const intensityAttribute = createDynamicAttribute(spawnIntensities, 1);
  const frameAttribute = createDynamicAttribute(spawnFrames, 1);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("motionExpansionDirection", directionAttribute);
  geometry.setAttribute("motionSpawnIntensity", intensityAttribute);
  geometry.setAttribute("motionSpawnFrame", frameAttribute);
  const material = createMotionTrailMaterial({
    appearance,
    trail,
    intensity,
    senseFadeUniform,
  });
  const points = new Points(geometry, material.pointsMaterial);

  // The ring follows the traveling swarms, so its bounds change every frame.
  // Skipping object-level culling keeps the whole ring in one stable draw.
  points.frustumCulled = false;

  let frame = 0;
  const previousPositions = new Float32Array(pointCount * COMPONENTS_PER_VALUE);
  let previousReady = false;

  return {
    points,
    spawnFromWorldPoints: (worldPositions) => {
      const slotStart = (frame % trail.lifetimeFrames) * pointCount;
      printSlot({
        worldPositions,
        pointCount,
        trail,
        slotStart,
        frame,
        previousPositions,
        previousReady,
        printedPositions,
        expansionDirections,
        spawnIntensities,
        spawnFrames,
      });
      previousReady = true;

      requestSlotUpload(positionAttribute, slotStart, pointCount);
      requestSlotUpload(directionAttribute, slotStart, pointCount);
      requestSlotUpload(intensityAttribute, slotStart, pointCount);
      requestSlotUpload(frameAttribute, slotStart, pointCount);
      material.setFrame(frame);
      frame += 1;
    },
    forgetHistory: () => {
      previousReady = false;
    },
    dispose: () => {
      geometry.dispose();
      material.pointsMaterial.dispose();
    },
  };
}

interface PrintSlotInput {
  readonly worldPositions: Float32Array;
  readonly pointCount: number;
  readonly trail: MotionSenseParameters["trail"];
  readonly slotStart: number;
  readonly frame: number;
  readonly previousPositions: Float32Array;
  readonly previousReady: boolean;
  readonly printedPositions: Float32Array;
  readonly expansionDirections: Float32Array;
  readonly spawnIntensities: Float32Array;
  readonly spawnFrames: Float32Array;
}

/** Write one complete ring slot from the current world positions. */
function printSlot(input: PrintSlotInput): void {
  const [centerX, centerY, centerZ] = getCentroid(
    input.worldPositions,
    input.pointCount,
  );

  for (let pointIndex = 0; pointIndex < input.pointCount; pointIndex += 1) {
    printTrailPoint(input, pointIndex, centerX, centerY, centerZ);
  }
}

/** Print one particle: position, outward direction, intensity, and frame. */
function printTrailPoint(
  input: PrintSlotInput,
  pointIndex: number,
  centerX: number,
  centerY: number,
  centerZ: number,
): void {
  const { trail, slotStart, frame } = input;
  const source = pointIndex * COMPONENTS_PER_VALUE;
  const target = (slotStart + pointIndex) * COMPONENTS_PER_VALUE;
  const worldX = input.worldPositions[source] ?? 0;
  const worldY = input.worldPositions[source + 1] ?? 0;
  const worldZ = input.worldPositions[source + 2] ?? 0;
  const movedMeters = trackMovedMeters(input, source, worldX, worldY, worldZ);

  input.printedPositions[target] = worldX;
  input.printedPositions[target + 1] = worldY;
  input.printedPositions[target + 2] = worldZ;
  writeUnitDirection(
    input.expansionDirections,
    target,
    worldX - centerX,
    worldY - centerY,
    worldZ - centerZ,
  );
  input.spawnIntensities[slotStart + pointIndex] = printsTrail(
    pointIndex,
    trail.density,
  )
    ? clampIntensity(movedMeters * trail.motionGain)
    : 0;
  input.spawnFrames[slotStart + pointIndex] = frame;
}

/** Distance to the previous frame's position; also store the new position. */
function trackMovedMeters(
  input: PrintSlotInput,
  source: number,
  worldX: number,
  worldY: number,
  worldZ: number,
): number {
  const movedMeters = input.previousReady
    ? Math.hypot(
        worldX - (input.previousPositions[source] ?? 0),
        worldY - (input.previousPositions[source + 1] ?? 0),
        worldZ - (input.previousPositions[source + 2] ?? 0),
      )
    : 0;

  input.previousPositions[source] = worldX;
  input.previousPositions[source + 1] = worldY;
  input.previousPositions[source + 2] = worldZ;
  return movedMeters;
}

function createDynamicAttribute(
  values: Float32Array,
  itemSize: number,
): BufferAttribute {
  const attribute = new BufferAttribute(values, itemSize);
  attribute.setUsage(DynamicDrawUsage);
  return attribute;
}

/** Request one contiguous partial upload covering only the printed slot. */
function requestSlotUpload(
  attribute: BufferAttribute,
  slotStart: number,
  pointCount: number,
): void {
  attribute.addUpdateRange(
    slotStart * attribute.itemSize,
    pointCount * attribute.itemSize,
  );
  attribute.needsUpdate = true;
}

function getCentroid(
  worldPositions: Float32Array,
  pointCount: number,
): readonly [number, number, number] {
  if (pointCount === 0) return [0, 0, 0];

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const source = pointIndex * COMPONENTS_PER_VALUE;
    sumX += worldPositions[source] ?? 0;
    sumY += worldPositions[source + 1] ?? 0;
    sumZ += worldPositions[source + 2] ?? 0;
  }
  return [sumX / pointCount, sumY / pointCount, sumZ / pointCount];
}

function writeUnitDirection(
  directions: Float32Array,
  target: number,
  deltaX: number,
  deltaY: number,
  deltaZ: number,
): void {
  const length = Math.hypot(deltaX, deltaY, deltaZ);
  if (length < 1e-6) {
    directions[target] = 0;
    directions[target + 1] = 1;
    directions[target + 2] = 0;
    return;
  }

  directions[target] = deltaX / length;
  directions[target + 1] = deltaY / length;
  directions[target + 2] = deltaZ / length;
}

/**
 * Deterministic per-point thinning: the same subset prints every frame, so
 * trails stay continuous instead of flickering.
 */
function printsTrail(pointIndex: number, density: number): boolean {
  if (density >= 1) return true;

  let hash = Math.imul(pointIndex, 2_654_435_761) | 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return ((hash >>> 16) & 0xffff) / 0x1_0000 < density;
}

function clampIntensity(rawIntensity: number): number {
  return Math.min(
    1,
    Math.max(MOTION_SENSE_SETTINGS.trailIntensityFloor, rawIntensity),
  );
}
