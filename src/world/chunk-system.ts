/**
 * Purpose: Keep a finite reusable window on the infinite world grid.
 * Context: Streamed modules need aligned world coordinates without growing resources forever.
 * Responsibility: Convert world positions into revisions of fixed chunk slots.
 * Boundary: Content generation, rendering resources, and frame scheduling stay elsewhere.
 */

/**
 * Sixteen metres is the smallest shared cell in the world.
 * Every larger chunk doubles this value, so differently sized module windows
 * always meet on the same grid lines and can sample the same world positions.
 */
export const BASE_CHUNK_SIZE = 16;

const NO_CHUNK_CHANGES: readonly ChunkAssignment[] = [];

/** Larger levels remain power-of-two multiples of the shared base grid. */
export type ChunkLevel = 0 | 1 | 2 | 3;

export interface ChunkWindowOptions {
  readonly level: ChunkLevel;

  /** Number of chunks kept around the center chunk in every X/Z direction. */
  readonly radius: number;
}

/**
 * Describes which reusable slot now represents one absolute world chunk.
 * A module can move repeated content immediately or generate new content from
 * chunkX and chunkZ before publishing it in the assigned slot.
 */
export interface ChunkAssignment {
  readonly slotIndex: number;
  readonly revision: number;
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly originX: number;
  readonly originZ: number;
}

interface AssignedChunk {
  revision: number;
  chunkX: number | undefined;
  chunkZ: number | undefined;
}

interface ChunkCoordinate {
  readonly chunkX: number;
  readonly chunkZ: number;
}

/**
 * A window is the finite resident part of the otherwise infinite chunk grid.
 *
 * It follows a world position and maps all required chunk coordinates onto a
 * fixed set of slots. When the center crosses a chunk boundary, only the slots
 * on the outgoing edge are reassigned to the new incoming edge. Modules keep
 * their CPU and GPU resources attached to those slots instead of allocating a
 * growing world.
 *
 * The caller chooses a radius large enough to contain the visible area plus a
 * preparation margin. This lets generated content become ready before it can
 * enter view while keeping this class independent from cameras and content.
 */
export class ChunkWindow {
  readonly chunkSize: number;
  readonly radius: number;
  readonly slotCount: number;

  private readonly chunksPerSide: number;
  private readonly assignedChunks: AssignedChunk[];
  private centerChunkX: number | undefined;
  private centerChunkZ: number | undefined;

  constructor({ level, radius }: ChunkWindowOptions) {
    this.chunkSize = getChunkSize(level);
    this.radius = radius;
    this.chunksPerSide = radius * 2 + 1;
    this.slotCount = this.chunksPerSide ** 2;
    this.assignedChunks = createEmptyChunkSlots(this.slotCount);
  }

  /**
   * Call once per frame with the current logical world position.
   * Staying inside the same center chunk returns the shared empty result and
   * therefore performs no allocations or slot work in the common frame path.
   */
  update(worldX: number, worldZ: number): readonly ChunkAssignment[] {
    const nextCenterChunkX = Math.floor(worldX / this.chunkSize);
    const nextCenterChunkZ = Math.floor(worldZ / this.chunkSize);

    if (
      this.centerChunkX === nextCenterChunkX &&
      this.centerChunkZ === nextCenterChunkZ
    ) {
      return NO_CHUNK_CHANGES;
    }

    this.centerChunkX = nextCenterChunkX;
    this.centerChunkZ = nextCenterChunkZ;
    return this.assignWindowChunks(nextCenterChunkX, nextCenterChunkZ);
  }

  /**
   * Check whether delayed work still belongs to its slot.
   * A false result means the player moved far enough for that slot to receive
   * a newer assignment, so the obsolete result must not be published.
   */
  isCurrent(assignment: ChunkAssignment): boolean {
    const assignedChunk = this.assignedChunks[assignment.slotIndex];
    return (
      assignedChunk?.revision === assignment.revision &&
      assignedChunk.chunkX === assignment.chunkX &&
      assignedChunk.chunkZ === assignment.chunkZ
    );
  }

  /**
   * Walk the square as one flat row-major list instead of nesting X/Z loops.
   * Each linear index is converted back into one column and one row.
   */
  private assignWindowChunks(
    centerChunkX: number,
    centerChunkZ: number,
  ): ChunkAssignment[] {
    const changedAssignments: ChunkAssignment[] = [];

    for (let windowIndex = 0; windowIndex < this.slotCount; windowIndex += 1) {
      const { chunkX, chunkZ } = this.getChunkCoordinate(
        windowIndex,
        centerChunkX,
        centerChunkZ,
      );
      const assignment = this.assignChunkIfChanged(chunkX, chunkZ);
      if (!assignment) continue;

      changedAssignments.push(assignment);
    }

    return changedAssignments;
  }

  /** Convert one flat window index into its absolute world-grid coordinate. */
  private getChunkCoordinate(
    windowIndex: number,
    centerChunkX: number,
    centerChunkZ: number,
  ): ChunkCoordinate {
    const column = windowIndex % this.chunksPerSide;
    const row = Math.floor(windowIndex / this.chunksPerSide);

    return {
      chunkX: centerChunkX + column - this.radius,
      chunkZ: centerChunkZ + row - this.radius,
    };
  }

  /** Reassign one slot and increment its revision only when coordinates change. */
  private assignChunkIfChanged(
    chunkX: number,
    chunkZ: number,
  ): ChunkAssignment | undefined {
    const slotIndex = getSlotIndex(chunkX, chunkZ, this.chunksPerSide);
    const assignedChunk = this.assignedChunks[slotIndex];
    if (!assignedChunk) return undefined;

    if (assignedChunk.chunkX === chunkX && assignedChunk.chunkZ === chunkZ) {
      return undefined;
    }

    assignedChunk.revision += 1;
    assignedChunk.chunkX = chunkX;
    assignedChunk.chunkZ = chunkZ;

    return {
      slotIndex,
      revision: assignedChunk.revision,
      chunkX,
      chunkZ,
      originX: chunkX * this.chunkSize,
      originZ: chunkZ * this.chunkSize,
    };
  }
}

/** Derive an aligned chunk size instead of accepting arbitrary metre values. */
export function getChunkSize(level: ChunkLevel): number {
  return BASE_CHUNK_SIZE * 2 ** level;
}

function createEmptyChunkSlots(slotCount: number): AssignedChunk[] {
  return Array.from({ length: slotCount }, () => ({
    revision: 0,
    chunkX: undefined,
    chunkZ: undefined,
  }));
}

/**
 * Map infinite world coordinates onto the finite slot square.
 * The positive modulo keeps the mapping stable on both sides of world zero.
 * A window-wide coordinate span is unique modulo chunksPerSide, so no two
 * currently resident chunks compete for the same slot.
 */
function getSlotIndex(
  chunkX: number,
  chunkZ: number,
  chunksPerSide: number,
): number {
  const slotColumn = positiveModulo(chunkX, chunksPerSide);
  const slotRow = positiveModulo(chunkZ, chunksPerSide);
  return slotRow * chunksPerSide + slotColumn;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
