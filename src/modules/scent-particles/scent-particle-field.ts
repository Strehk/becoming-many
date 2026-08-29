/**
 * Purpose: Store and render the streamed Scent Particle field.
 * Context: The Scent Particles module recycles chunk slots while keeping one draw call.
 * Responsibility: Own fixed particle buffers, forest-bound emitter generation, partial uploads, and disposal.
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
import type { WorldSurface } from "../../world-surface/world-surface";
import type { ZoneId } from "../../world-surface/zone-settings";
import {
  createScentParticleMaterial,
  type ScentParticleMaterial,
} from "./scent-particle-material";
import {
  SCENT_PARTICLES_SETTINGS,
  type ScentParticlesParameters,
} from "./scent-particles-settings";

const COMPONENTS_PER_VALUE = 3;
const RANDOM_VALUE_RANGE = 0x1_0000_0000;

/** Fixed random component indexes; candidate components follow after them. */
const EMITTER_RANDOM_HEIGHT = 2;
const EMITTER_RANDOM_COLOR = 3;
// Scatter spends two component ranges: the three axes at 4..6 and their
// second draw one axis count later at 7..9. Everything after starts at 10.
const PARTICLE_RANDOM_FIRST_AXIS = 4;
const SCATTER_AXIS_COUNT = 3;
const PARTICLE_RANDOM_PHASE = 10;
const CANDIDATE_RANDOM_FIRST = 11;

interface ScentParticleFieldOptions {
  readonly parameters: ScentParticlesParameters;
  readonly chunkSize: number;
  readonly chunkSlotCount: number;
  readonly groundYAt: WorldSurface["groundYAt"];
  readonly zoneAt: WorldSurface["zoneAt"];
}

interface ScentEmitterAnchor {
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
}

/**
 * Every resident chunk shares one Points object. Each reusable slot owns
 * one fixed, contiguous range within the position, color, phase, and
 * visibility buffers.
 */
export interface ScentParticleField {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  readonly material: ScentParticleMaterial;
  readonly parameters: ScentParticlesParameters;
  readonly particlesPerChunk: number;
  readonly valuesPerChunk: number;
  readonly chunkSize: number;
  readonly groundYAt: WorldSurface["groundYAt"];
  readonly zoneAt: WorldSurface["zoneAt"];
  readonly signatureColors: Float32Array;
  readonly renderedPositions: Float32Array;
  readonly renderedColors: Float32Array;
  readonly renderedPhases: Float32Array;
  readonly renderedVisibility: Float32Array;
  readonly positionAttribute: BufferAttribute;
  readonly colorAttribute: BufferAttribute;
  readonly phaseAttribute: BufferAttribute;
  readonly visibilityAttribute: BufferAttribute;
}

/** Allocate the one fixed-capacity render object used for the loaded lifetime. */
export function createScentParticleField({
  parameters,
  chunkSize,
  chunkSlotCount,
  groundYAt,
  zoneAt,
}: ScentParticleFieldOptions): ScentParticleField {
  const particlesPerChunk =
    parameters.placement.emittersPerChunk *
    parameters.emission.particlesPerEmitter;
  const valuesPerChunk = particlesPerChunk * COMPONENTS_PER_VALUE;
  const renderedPositions = new Float32Array(valuesPerChunk * chunkSlotCount);
  const renderedColors = new Float32Array(valuesPerChunk * chunkSlotCount);
  const renderedPhases = new Float32Array(particlesPerChunk * chunkSlotCount);
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
  const visibilityAttribute = new BufferAttribute(renderedVisibility, 1);
  positionAttribute.setUsage(DynamicDrawUsage);
  colorAttribute.setUsage(DynamicDrawUsage);
  phaseAttribute.setUsage(DynamicDrawUsage);
  visibilityAttribute.setUsage(DynamicDrawUsage);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", colorAttribute);
  geometry.setAttribute("scentPhase", phaseAttribute);
  geometry.setAttribute("scentVisible", visibilityAttribute);
  const material = createScentParticleMaterial({
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
    parameters,
    particlesPerChunk,
    valuesPerChunk,
    chunkSize,
    groundYAt,
    zoneAt,
    signatureColors: createSignatureColors(parameters.colors),
    renderedPositions,
    renderedColors,
    renderedPhases,
    renderedVisibility,
    positionAttribute,
    colorAttribute,
    phaseAttribute,
    visibilityAttribute,
  };
}

/**
 * Fill every slot before the first render. No update ranges are required:
 * Three.js uploads a new BufferAttribute completely when it first sees it.
 */
export function initializeScentParticleSlots(
  field: ScentParticleField,
  assignments: readonly ChunkAssignment[],
): void {
  for (const assignment of assignments) writeChunkSlot(field, assignment);
}

/** Move one recycled slot and request a partial GPU upload for only its range. */
export function updateScentParticleSlot(
  field: ScentParticleField,
  assignment: ChunkAssignment,
): void {
  writeChunkSlot(field, assignment);

  const particleStart = assignment.slotIndex * field.particlesPerChunk;
  const valueStart = particleStart * COMPONENTS_PER_VALUE;
  field.positionAttribute.addUpdateRange(valueStart, field.valuesPerChunk);
  field.colorAttribute.addUpdateRange(valueStart, field.valuesPerChunk);
  field.phaseAttribute.addUpdateRange(particleStart, field.particlesPerChunk);
  field.visibilityAttribute.addUpdateRange(
    particleStart,
    field.particlesPerChunk,
  );
  field.positionAttribute.needsUpdate = true;
  field.colorAttribute.needsUpdate = true;
  field.phaseAttribute.needsUpdate = true;
  field.visibilityAttribute.needsUpdate = true;
}

export function disposeScentParticleField(field: ScentParticleField): void {
  field.points.geometry.dispose();
  field.points.material.dispose();
}

/** Generate the deterministic forest-bound emitters for one absolute chunk. */
function writeChunkSlot(
  field: ScentParticleField,
  assignment: ChunkAssignment,
): void {
  const { placement } = field.parameters;

  for (
    let emitterIndex = 0;
    emitterIndex < placement.emittersPerChunk;
    emitterIndex += 1
  ) {
    writeEmitterParticles(field, assignment, emitterIndex);
  }
}

/**
 * Absolute chunk coordinates seed all random values. Revisiting a chunk
 * recreates the same emitters, while neighboring chunks never repeat one
 * template. Emitters exist only where a bounded candidate search finds a
 * source zone; misses keep their fixed particle range hidden.
 */
function writeEmitterParticles(
  field: ScentParticleField,
  assignment: ChunkAssignment,
  emitterIndex: number,
): void {
  const { emission, colors } = field.parameters;
  const firstParticleIndex =
    assignment.slotIndex * field.particlesPerChunk +
    emitterIndex * emission.particlesPerEmitter;
  const anchor = findSourceZoneAnchor(field, assignment, emitterIndex);

  if (!anchor) {
    field.renderedVisibility.fill(
      0,
      firstParticleIndex,
      firstParticleIndex + emission.particlesPerEmitter,
    );
    return;
  }

  const colorIndex = Math.floor(
    getScentRandom(assignment, emitterIndex, -1, EMITTER_RANDOM_COLOR) *
      colors.length,
  );
  const colorValueOffset = colorIndex * COMPONENTS_PER_VALUE;

  for (
    let particleIndex = 0;
    particleIndex < emission.particlesPerEmitter;
    particleIndex += 1
  ) {
    const particleOffset = firstParticleIndex + particleIndex;
    const valueOffset = particleOffset * COMPONENTS_PER_VALUE;
    const scatterX = getScatter(
      assignment,
      emitterIndex,
      particleIndex,
      PARTICLE_RANDOM_FIRST_AXIS,
      emission.cloudRadiusMeters,
    );
    const scatterY = getScatter(
      assignment,
      emitterIndex,
      particleIndex,
      PARTICLE_RANDOM_FIRST_AXIS + 1,
      emission.cloudHeightMeters / 2,
    );
    const scatterZ = getScatter(
      assignment,
      emitterIndex,
      particleIndex,
      PARTICLE_RANDOM_FIRST_AXIS + 2,
      emission.cloudRadiusMeters,
    );

    field.renderedPositions[valueOffset] = anchor.worldX + scatterX;
    field.renderedPositions[valueOffset + 1] = anchor.worldY + scatterY;
    field.renderedPositions[valueOffset + 2] = anchor.worldZ + scatterZ;

    for (let component = 0; component < COMPONENTS_PER_VALUE; component += 1) {
      field.renderedColors[valueOffset + component] =
        field.signatureColors[colorValueOffset + component] ?? 0;
    }

    field.renderedPhases[particleOffset] = getScentRandom(
      assignment,
      emitterIndex,
      particleIndex,
      PARTICLE_RANDOM_PHASE,
    );
    field.renderedVisibility[particleOffset] = 1;
  }
}

/**
 * Try a bounded number of deterministic candidate positions and keep the
 * first one inside a scent source zone, anchored just above the ground.
 */
function findSourceZoneAnchor(
  field: ScentParticleField,
  assignment: ChunkAssignment,
  emitterIndex: number,
): ScentEmitterAnchor | undefined {
  const { placement } = field.parameters;
  const sourceZones: readonly ZoneId[] = SCENT_PARTICLES_SETTINGS.sourceZones;

  for (
    let attempt = 0;
    attempt < SCENT_PARTICLES_SETTINGS.placementAttemptsPerEmitter;
    attempt += 1
  ) {
    const componentBase = CANDIDATE_RANDOM_FIRST + attempt * 2;
    const worldX =
      assignment.originX +
      getScentRandom(assignment, emitterIndex, -1, componentBase) *
        field.chunkSize;
    const worldZ =
      assignment.originZ +
      getScentRandom(assignment, emitterIndex, -1, componentBase + 1) *
        field.chunkSize;
    if (!sourceZones.includes(field.zoneAt(worldX, worldZ))) continue;

    const heightRandom = getScentRandom(
      assignment,
      emitterIndex,
      -1,
      EMITTER_RANDOM_HEIGHT,
    );
    const worldY =
      field.groundYAt(worldX, worldZ) +
      placement.minHeightMeters +
      heightRandom * (placement.maxHeightMeters - placement.minHeightMeters);

    return { worldX, worldY, worldZ };
  }

  return undefined;
}

/**
 * Return one symmetric scatter offset within the given half extent, drawn so
 * the cloud thins out toward its boundary instead of ending at a wall.
 *
 * Averaging two independent draws makes the offset triangular: density peaks
 * at the anchor and falls linearly to nothing at the half extent, so the
 * cloud keeps a defined core and dissolves at its edge. One draw alone
 * spreads particles evenly and leaves the outermost as solid as the centre.
 * The half extent stays the hard bound, so authored cloud sizes still hold.
 */
function getScatter(
  assignment: ChunkAssignment,
  emitterIndex: number,
  particleIndex: number,
  componentIndex: number,
  halfExtent: number,
): number {
  const firstDraw = getScentRandom(
    assignment,
    emitterIndex,
    particleIndex,
    componentIndex,
  );
  const secondDraw = getScentRandom(
    assignment,
    emitterIndex,
    particleIndex,
    componentIndex + SCATTER_AXIS_COUNT,
  );

  return (firstDraw + secondDraw - 1) * halfExtent;
}

/** Convert the authored palette once into working-color-space triples. */
function createSignatureColors(colors: readonly number[]): Float32Array {
  const signatureColors = new Float32Array(
    colors.length * COMPONENTS_PER_VALUE,
  );
  const converter = new Color();

  colors.forEach((color, colorIndex) => {
    converter.set(color);
    const valueOffset = colorIndex * COMPONENTS_PER_VALUE;
    signatureColors[valueOffset] = converter.r;
    signatureColors[valueOffset + 1] = converter.g;
    signatureColors[valueOffset + 2] = converter.b;
  });

  return signatureColors;
}

/**
 * Return one stable pseudo-random value in [0, 1) without keeping RNG state.
 * Emitter-level values pass particleIndex -1 so they share no stream with
 * their particles.
 */
function getScentRandom(
  assignment: ChunkAssignment,
  emitterIndex: number,
  particleIndex: number,
  componentIndex: number,
): number {
  let hash = Math.imul(assignment.chunkX, 73_856_093);
  hash ^= Math.imul(assignment.chunkZ, 19_349_663);
  hash ^= Math.imul(emitterIndex + 1, 2_971_215_073);
  hash ^= Math.imul(particleIndex + 2, 83_492_791);
  hash ^= Math.imul(componentIndex + 1, 1_103_515_245);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);

  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}
