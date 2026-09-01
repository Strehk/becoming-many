/**
 * Purpose: Store and render the streamed scent radiating from the plants.
 * Context: Every plant carries its family's signature; the field streams with the traveler.
 * Responsibility: Own fixed particle buffers, per-plant emission, partial uploads, and disposal.
 * Boundary: Chunk selection, stream scheduling, camera movement, and lifecycle stay elsewhere.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Points,
  type PointsMaterial,
} from "three";
import type { ChunkAssignment } from "../../world/chunk-system";
import type { PlantScentSource } from "../scent-sources";
import {
  createScentParticleMaterial,
  type ScentParticleMaterial,
} from "./scent-particle-material";
import type {
  PlantScentSignature,
  ScentParticlesParameters,
} from "./scent-particles-settings";
import {
  createScentRandomKey,
  getScentRandom,
  type ScentRandomKey,
} from "./scent-random";

const COMPONENTS_PER_VALUE = 3;

/** Fixed per-particle random component indexes. */
const PARTICLE_RANDOM_HEIGHT = 0;
const PARTICLE_RANDOM_SCATTER_X = 1;
const PARTICLE_RANDOM_SCATTER_Z = 3;
const PARTICLE_RANDOM_PHASE = 5;

interface ScentParticleFieldOptions {
  readonly parameters: ScentParticlesParameters;
  readonly plantSource: PlantScentSource;
  readonly chunkSize: number;
  readonly chunkSlotCount: number;
  /** Shared with the module handle; a show fades the sense through it. */
  readonly senseFadeUniform?: { readonly value: number };
}

/**
 * Every resident chunk shares one Points object. Each reusable slot owns one
 * fixed, contiguous range sized for the densest possible chunk, and packs the
 * plants it actually holds into the front of that range.
 */
export interface ScentParticleField {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  readonly material: ScentParticleMaterial;
  readonly parameters: ScentParticlesParameters;
  readonly plantSource: PlantScentSource;
  readonly signatures: readonly PlantScentSignature[];
  readonly signatureColors: Float32Array;
  readonly particlesPerChunk: number;
  readonly valuesPerChunk: number;
  readonly chunkSize: number;
  readonly renderedPositions: Float32Array;
  readonly renderedColors: Float32Array;
  readonly renderedPhases: Float32Array;
  readonly renderedRises: Float32Array;
  readonly renderedVisibility: Float32Array;
  readonly positionAttribute: BufferAttribute;
  readonly colorAttribute: BufferAttribute;
  readonly phaseAttribute: BufferAttribute;
  readonly riseAttribute: BufferAttribute;
  readonly visibilityAttribute: BufferAttribute;

  /** Reused across one slot write so no particle allocates its own key. */
  readonly randomKey: ScentRandomKey;
}

/** Allocate the one fixed-capacity render object used for the loaded lifetime. */
export function createScentParticleField({
  parameters,
  plantSource,
  chunkSize,
  chunkSlotCount,
  senseFadeUniform,
}: ScentParticleFieldOptions): ScentParticleField {
  const signatures = plantSource.groupIds.map(
    (groupId) => parameters.plants[groupId],
  );
  const maxParticlesPerPlant = signatures.reduce(
    (largest, { particlesPerPlant }) => Math.max(largest, particlesPerPlant),
    0,
  );
  const particlesPerChunk =
    plantSource.maxPlantsPerChunk(chunkSize) * maxParticlesPerPlant;
  const valuesPerChunk = particlesPerChunk * COMPONENTS_PER_VALUE;
  const renderedPositions = new Float32Array(valuesPerChunk * chunkSlotCount);
  const renderedColors = new Float32Array(valuesPerChunk * chunkSlotCount);
  const renderedPhases = new Float32Array(particlesPerChunk * chunkSlotCount);
  const renderedRises = new Float32Array(particlesPerChunk * chunkSlotCount);
  const renderedVisibility = new Float32Array(
    particlesPerChunk * chunkSlotCount,
  );
  const positionAttribute = new BufferAttribute(
    renderedPositions,
    COMPONENTS_PER_VALUE,
  );
  const colorAttribute = new BufferAttribute(
    renderedColors,
    COMPONENTS_PER_VALUE,
  );
  const phaseAttribute = new BufferAttribute(renderedPhases, 1);
  const riseAttribute = new BufferAttribute(renderedRises, 1);
  const visibilityAttribute = new BufferAttribute(renderedVisibility, 1);
  positionAttribute.setUsage(DynamicDrawUsage);
  colorAttribute.setUsage(DynamicDrawUsage);
  phaseAttribute.setUsage(DynamicDrawUsage);
  riseAttribute.setUsage(DynamicDrawUsage);
  visibilityAttribute.setUsage(DynamicDrawUsage);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", colorAttribute);
  geometry.setAttribute("scentPhase", phaseAttribute);
  geometry.setAttribute("scentRise", riseAttribute);
  geometry.setAttribute("scentVisible", visibilityAttribute);
  const material = createScentParticleMaterial({
    appearance: parameters.appearance,
    motion: parameters.motion,
    senseFadeUniform,
  });
  const points = new Points(geometry, material.pointsMaterial);

  // The combined object follows the streamed window, so its bounds change when
  // slots move. Skipping object-level culling avoids rebuilding those bounds
  // and keeps all resident chunks in one draw. Camera distance still clips points.
  points.frustumCulled = false;

  return {
    points,
    material,
    parameters,
    plantSource,
    signatures,
    signatureColors: createSignatureColors(signatures),
    particlesPerChunk,
    valuesPerChunk,
    chunkSize,
    renderedPositions,
    renderedColors,
    renderedPhases,
    renderedRises,
    renderedVisibility,
    positionAttribute,
    colorAttribute,
    phaseAttribute,
    riseAttribute,
    visibilityAttribute,
    randomKey: createScentRandomKey(),
  };
}

/** One plant of a chunk, gathered before its particles are written. */
interface ScentPlantRecord {
  worldX: number;
  groundY: number;
  worldZ: number;
  heightMeters: number;
  groupIndex: number;
}

/**
 * The resumable write of one chunk slot. A dense forest chunk holds thousands
 * of particles, which is far more than one frame slice should spend, so the
 * write is gathered once and then spent in bounded steps. The GPU keeps the
 * previous chunk until the last step uploads, so a slot is never half new.
 */
export interface ScentChunkWriter {
  readonly assignment: ChunkAssignment;
  readonly plants: ScentPlantRecord[];
  gathered: boolean;
  nextPlant: number;
  particleCursor: number;
}

/** Particles one step may write before returning to the shared queue. */
const PARTICLES_PER_STEP = 256;

export function createScentChunkWriter(
  assignment: ChunkAssignment,
): ScentChunkWriter {
  return {
    assignment,
    plants: [],
    gathered: false,
    nextPlant: 0,
    particleCursor: 0,
  };
}

/**
 * Perform one bounded part of a slot write and report whether it finished.
 * The first step replays the chunk's plants; every later step spends its
 * particle budget on them.
 */
export function writeNextScentStep(
  field: ScentParticleField,
  writer: ScentChunkWriter,
): boolean {
  if (!writer.gathered) {
    gatherChunkPlants(field, writer);
    return writer.plants.length === 0;
  }

  const slotEnd =
    writer.assignment.slotIndex * field.particlesPerChunk +
    field.particlesPerChunk;
  let written = 0;

  while (
    writer.nextPlant < writer.plants.length &&
    written < PARTICLES_PER_STEP
  ) {
    const plant = writer.plants[writer.nextPlant];
    writer.nextPlant += 1;
    if (!plant) continue;

    const signature = field.signatures[plant.groupIndex];
    if (!signature) continue;
    const nextCursor = writer.particleCursor + signature.particlesPerPlant;

    // The capacity is the source's own worst case, so this cannot trip unless
    // a source breaks its bound. Dropping the overflow keeps the fixed
    // buffers intact instead of corrupting the neighbouring slot.
    if (nextCursor > slotEnd) continue;

    writePlantParticles(field, writer.assignment, {
      signature,
      groupIndex: plant.groupIndex,
      plantIndex: writer.nextPlant - 1,
      firstParticleIndex: writer.particleCursor,
      worldX: plant.worldX,
      groundY: plant.groundY,
      worldZ: plant.worldZ,
      heightMeters: plant.heightMeters,
    });
    writer.particleCursor = nextCursor;
    written += signature.particlesPerPlant;
  }

  return writer.nextPlant >= writer.plants.length;
}

/**
 * Replay one absolute chunk's plants. Absolute chunk coordinates seed every
 * random value, so revisiting a chunk recreates the same scent. The slot is
 * hidden first: a chunk with fewer plants than the worst case leaves the tail
 * unused, and a stale tail would keep the previous chunk's particles alive.
 */
function gatherChunkPlants(
  field: ScentParticleField,
  writer: ScentChunkWriter,
): void {
  const { assignment } = writer;
  const slotStart = assignment.slotIndex * field.particlesPerChunk;
  field.renderedVisibility.fill(
    0,
    slotStart,
    slotStart + field.particlesPerChunk,
  );
  writer.gathered = true;
  writer.particleCursor = slotStart;

  field.plantSource.appendChunkPlants(
    assignment.chunkX,
    assignment.chunkZ,
    field.chunkSize,
    (worldX, groundY, worldZ, heightMeters, groupIndex) => {
      writer.plants.push({
        worldX,
        groundY,
        worldZ,
        heightMeters,
        groupIndex,
      });
    },
  );
}

/**
 * Fill every slot before the first render. No update ranges are required:
 * Three.js uploads a new BufferAttribute completely when it first sees it.
 */
export function initializeScentParticleSlots(
  field: ScentParticleField,
  assignments: readonly ChunkAssignment[],
): void {
  for (const assignment of assignments) {
    const writer = createScentChunkWriter(assignment);
    while (!writeNextScentStep(field, writer)) {
      // Startup is synchronous; recycled chunks spend one step per frame.
    }
  }
}

/** Request a partial GPU upload for one finished slot and nothing else. */
export function uploadScentParticleSlot(
  field: ScentParticleField,
  slotIndex: number,
): void {
  const particleStart = slotIndex * field.particlesPerChunk;
  const valueStart = particleStart * COMPONENTS_PER_VALUE;
  field.positionAttribute.addUpdateRange(valueStart, field.valuesPerChunk);
  field.colorAttribute.addUpdateRange(valueStart, field.valuesPerChunk);
  field.phaseAttribute.addUpdateRange(particleStart, field.particlesPerChunk);
  field.riseAttribute.addUpdateRange(particleStart, field.particlesPerChunk);
  field.visibilityAttribute.addUpdateRange(
    particleStart,
    field.particlesPerChunk,
  );
  field.positionAttribute.needsUpdate = true;
  field.colorAttribute.needsUpdate = true;
  field.phaseAttribute.needsUpdate = true;
  field.riseAttribute.needsUpdate = true;
  field.visibilityAttribute.needsUpdate = true;
}

export function disposeScentParticleField(field: ScentParticleField): void {
  field.points.geometry.dispose();
  field.points.material.dispose();
}

interface PlantEmission {
  readonly signature: PlantScentSignature;
  readonly groupIndex: number;
  readonly plantIndex: number;
  readonly firstParticleIndex: number;
  readonly worldX: number;
  readonly groundY: number;
  readonly worldZ: number;
  readonly heightMeters: number;
}

/** Scatter one plant's particles through the emission volume it owns. */
function writePlantParticles(
  field: ScentParticleField,
  assignment: ChunkAssignment,
  emission: PlantEmission,
): void {
  const { signature, heightMeters } = emission;
  const { randomKey } = field;
  randomKey.chunkX = assignment.chunkX;
  randomKey.chunkZ = assignment.chunkZ;
  randomKey.sourceIndex = emission.plantIndex;
  const colorValueOffset = emission.groupIndex * COMPONENTS_PER_VALUE;
  const emissionRadius = signature.emissionRadiusFraction * heightMeters;
  const bottomY = signature.emissionBottomFraction * heightMeters;
  const bandHeight =
    (signature.emissionTopFraction - signature.emissionBottomFraction) *
    heightMeters;

  for (
    let particleIndex = 0;
    particleIndex < signature.particlesPerPlant;
    particleIndex += 1
  ) {
    const particleOffset = emission.firstParticleIndex + particleIndex;
    const valueOffset = particleOffset * COMPONENTS_PER_VALUE;
    randomKey.particleIndex = particleIndex;
    const heightRandom = getScentRandom(randomKey, PARTICLE_RANDOM_HEIGHT);

    field.renderedPositions[valueOffset] =
      emission.worldX +
      getScatter(randomKey, PARTICLE_RANDOM_SCATTER_X, emissionRadius);
    field.renderedPositions[valueOffset + 1] =
      emission.groundY + bottomY + heightRandom * bandHeight;
    field.renderedPositions[valueOffset + 2] =
      emission.worldZ +
      getScatter(randomKey, PARTICLE_RANDOM_SCATTER_Z, emissionRadius);

    for (let component = 0; component < COMPONENTS_PER_VALUE; component += 1) {
      field.renderedColors[valueOffset + component] =
        field.signatureColors[colorValueOffset + component] ?? 0;
    }

    field.renderedPhases[particleOffset] = getScentRandom(
      randomKey,
      PARTICLE_RANDOM_PHASE,
    );
    field.renderedRises[particleOffset] = signature.riseHeightMeters;
    field.renderedVisibility[particleOffset] = 1;
  }
}

/**
 * Return one symmetric scatter offset within the given half extent, drawn so
 * the emission thins out toward its boundary instead of ending at a wall.
 *
 * Averaging two independent draws makes the offset triangular: density peaks
 * on the plant's own axis and falls linearly to nothing at the half extent,
 * so the scent keeps a defined core at the plant and dissolves away from it.
 * The half extent stays the hard bound, so authored radii still hold.
 */
function getScatter(
  randomKey: ScentRandomKey,
  componentIndex: number,
  halfExtent: number,
): number {
  const firstDraw = getScentRandom(randomKey, componentIndex);
  const secondDraw = getScentRandom(randomKey, componentIndex + 1);

  return (firstDraw + secondDraw - 1) * halfExtent;
}

/** Convert the authored signatures once into working-color-space triples. */
function createSignatureColors(
  signatures: readonly PlantScentSignature[],
): Float32Array {
  const signatureColors = new Float32Array(
    signatures.length * COMPONENTS_PER_VALUE,
  );
  const converter = new Color();

  signatures.forEach((signature, signatureIndex) => {
    converter.set(signature.color);
    const valueOffset = signatureIndex * COMPONENTS_PER_VALUE;
    signatureColors[valueOffset] = converter.r;
    signatureColors[valueOffset + 1] = converter.g;
    signatureColors[valueOffset + 2] = converter.b;
  });

  return signatureColors;
}
