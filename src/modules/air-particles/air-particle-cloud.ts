/**
 * Purpose: Store and render the streamed Air Particles cloud.
 * Context: The Air Particles module recycles volume slots while keeping one draw call.
 * Responsibility: Own fixed particle buffers, surface visibility, partial uploads, and disposal.
 * Boundary: Volume selection, stream scheduling, camera movement, and lifecycle stay elsewhere.
 */

import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Points,
  type PointsMaterial,
} from "three";
import type { VolumeChunkAssignment } from "../../world/volume-chunk-window";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  type AirParticleMaterial,
  createAirParticleMaterial,
} from "./air-particle-material";
import {
  AIR_PARTICLES_SETTINGS,
  type AirParticlesParameters,
} from "./air-particles-settings";

const POSITION_COMPONENT_COUNT = 3;
const RANDOM_VALUE_RANGE = 0x1_0000_0000;

interface AirParticleCloudOptions {
  readonly parameters: AirParticlesParameters;
  readonly chunkSize: number;
  readonly chunkSlotCount: number;
  readonly surfaceYAt?: WorldSurface["surfaceYAt"];
}

interface AirParticleSlot {
  readonly assignment: VolumeChunkAssignment;
  readonly firstParticleIndex: number;
}

/**
 * Every resident volume shares one Points object. Each reusable slot owns
 * one fixed, contiguous range within the position buffer.
 */
export interface AirParticleCloud {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  readonly material: AirParticleMaterial;
  readonly particlesPerChunk: number;
  readonly valuesPerChunk: number;
  readonly chunkSize: number;
  readonly surfaceYAt: WorldSurface["surfaceYAt"] | undefined;
  readonly renderedPositions: Float32Array;
  readonly renderedVisibility: Float32Array;
  readonly positionAttribute: BufferAttribute;
  readonly visibilityAttribute: BufferAttribute;
}

/** Allocate the one fixed-capacity render object used for the loaded lifetime. */
export function createAirParticleCloud({
  parameters,
  chunkSize,
  chunkSlotCount,
  surfaceYAt,
}: AirParticleCloudOptions): AirParticleCloud {
  const particlesPerChunk = parameters.density.particlesPerChunk;
  const valuesPerChunk = particlesPerChunk * POSITION_COMPONENT_COUNT;
  const renderedPositions = new Float32Array(valuesPerChunk * chunkSlotCount);
  const renderedVisibility = new Float32Array(
    particlesPerChunk * chunkSlotCount,
  );
  const positionAttribute = new BufferAttribute(
    renderedPositions,
    POSITION_COMPONENT_COUNT,
  );
  const visibilityAttribute = new BufferAttribute(renderedVisibility, 1);
  positionAttribute.setUsage(DynamicDrawUsage);
  visibilityAttribute.setUsage(DynamicDrawUsage);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("airParticleVisible", visibilityAttribute);
  const material = createAirParticleMaterial({
    appearance: parameters.appearance,
    motion: parameters.motion,
  });
  const points = new Points(geometry, material.pointsMaterial);

  // The combined object follows the streamed window, so its bounds change when
  // slots move. Skipping object-level culling avoids rebuilding those bounds
  // and keeps all resident chunks in one draw. Camera distance still clips points.
  points.frustumCulled = false;

  return {
    points,
    material,
    particlesPerChunk,
    valuesPerChunk,
    chunkSize,
    surfaceYAt,
    renderedPositions,
    renderedVisibility,
    positionAttribute,
    visibilityAttribute,
  };
}

/**
 * Fill every slot before the first render. No update ranges are required:
 * Three.js uploads a new BufferAttribute completely when it first sees it.
 */
export function initializeAirParticleSlots(
  cloud: AirParticleCloud,
  assignments: readonly VolumeChunkAssignment[],
): void {
  for (const assignment of assignments) writeChunkSlot(cloud, assignment);
}

/** Move one recycled slot and request a partial GPU upload for only its range. */
export function updateAirParticleSlot(
  cloud: AirParticleCloud,
  assignment: VolumeChunkAssignment,
): void {
  writeChunkSlot(cloud, assignment);

  const particleStart = assignment.slotIndex * cloud.particlesPerChunk;
  const positionStart = particleStart * POSITION_COMPONENT_COUNT;
  cloud.positionAttribute.addUpdateRange(positionStart, cloud.valuesPerChunk);
  cloud.visibilityAttribute.addUpdateRange(
    particleStart,
    cloud.particlesPerChunk,
  );
  cloud.positionAttribute.needsUpdate = true;
  cloud.visibilityAttribute.needsUpdate = true;
}

export function disposeAirParticleCloud(cloud: AirParticleCloud): void {
  cloud.points.geometry.dispose();
  cloud.points.material.dispose();
}

/** Generate deterministic random positions for the world volume using this slot. */
function writeChunkSlot(
  cloud: AirParticleCloud,
  assignment: VolumeChunkAssignment,
): void {
  const slot: AirParticleSlot = {
    assignment,
    firstParticleIndex: assignment.slotIndex * cloud.particlesPerChunk,
  };

  for (
    let particleIndex = 0;
    particleIndex < cloud.particlesPerChunk;
    particleIndex += 1
  ) {
    writeParticlePosition(cloud, slot, particleIndex);
  }
}

/**
 * World coordinates seed the random values. Revisiting a volume recreates the
 * same particles, while neighboring volumes never expose one repeated template.
 */
function writeParticlePosition(
  cloud: AirParticleCloud,
  slot: AirParticleSlot,
  particleIndex: number,
): void {
  const { assignment } = slot;
  const randomX = getParticleRandom(assignment, particleIndex, 0);
  const randomY = getParticleRandom(assignment, particleIndex, 1);
  const randomZ = getParticleRandom(assignment, particleIndex, 2);
  const visibilityOffset = slot.firstParticleIndex + particleIndex;
  const positionOffset = visibilityOffset * POSITION_COMPONENT_COUNT;
  const worldX = assignment.originX + randomX * cloud.chunkSize;
  const worldY = assignment.originY + randomY * cloud.chunkSize;
  const worldZ = assignment.originZ + randomZ * cloud.chunkSize;

  cloud.renderedPositions[positionOffset] = worldX;
  cloud.renderedPositions[positionOffset + 1] = worldY;
  cloud.renderedPositions[positionOffset + 2] = worldZ;
  const minimumAirY = cloud.surfaceYAt
    ? cloud.surfaceYAt(worldX, worldZ) +
      AIR_PARTICLES_SETTINGS.surfaceClearanceMeters
    : Number.NEGATIVE_INFINITY;

  // Underground candidates remain in the fixed slot but never reach rasterization.
  cloud.renderedVisibility[visibilityOffset] = Number(worldY >= minimumAirY);
}

/** Return one stable pseudo-random value in [0, 1) without keeping RNG state. */
function getParticleRandom(
  assignment: VolumeChunkAssignment,
  particleIndex: number,
  coordinateIndex: number,
): number {
  let hash = Math.imul(assignment.chunkX, 73_856_093);
  hash ^= Math.imul(assignment.chunkZ, 19_349_663);
  hash ^= Math.imul(assignment.chunkY, 2_971_215_073);
  hash ^= Math.imul(particleIndex + 1, 83_492_791);
  hash ^= Math.imul(coordinateIndex + 1, 1_103_515_245);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);

  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}
