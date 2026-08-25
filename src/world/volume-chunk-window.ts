/**
 * Purpose: Keep a finite reusable cube on the infinite world grid.
 * Context: Volumetric modules must stream upward and downward as well as horizontally.
 * Responsibility: Convert X/Y/Z world positions into revisions of fixed volume slots.
 * Boundary: Content generation, rendering resources, and frame scheduling stay elsewhere.
 */

import { type ChunkLevel, getChunkSize } from "./chunk-system";

const NO_VOLUME_CHANGES: readonly VolumeChunkAssignment[] = [];

export interface VolumeChunkWindowOptions {
  readonly level: ChunkLevel;

  /** Number of chunks kept around the center in every X/Y/Z direction. */
  readonly radius: number;
}

/** Describes which reusable slot now represents one absolute world volume. */
export interface VolumeChunkAssignment {
  readonly slotIndex: number;
  readonly revision: number;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
  readonly originX: number;
  readonly originY: number;
  readonly originZ: number;
}

interface AssignedVolumeChunk {
  revision: number;
  chunkX: number | undefined;
  chunkY: number | undefined;
  chunkZ: number | undefined;
}

interface VolumeChunkCoordinate {
  readonly chunkX: number;
  readonly chunkY: number;
  readonly chunkZ: number;
}

interface VolumeAssignmentOptions {
  readonly slotIndex: number;
  readonly revision: number;
  readonly coordinate: VolumeChunkCoordinate;
  readonly chunkSize: number;
}

/**
 * A volume window is the finite cube currently kept around one world position.
 * It uses the same aligned chunk sizes as the flat ChunkWindow, but includes Y.
 * Crossing one boundary therefore recycles only the outgoing square face.
 */
export class VolumeChunkWindow {
  readonly chunkSize: number;
  readonly radius: number;
  readonly slotCount: number;

  private readonly chunksPerSide: number;
  private readonly chunksPerLayer: number;
  private readonly assignedVolumes: AssignedVolumeChunk[];
  private centerChunkX: number | undefined;
  private centerChunkY: number | undefined;
  private centerChunkZ: number | undefined;

  constructor({ level, radius }: VolumeChunkWindowOptions) {
    this.chunkSize = getChunkSize(level);
    this.radius = radius;
    this.chunksPerSide = radius * 2 + 1;
    this.chunksPerLayer = this.chunksPerSide ** 2;
    this.slotCount = this.chunksPerSide ** 3;
    this.assignedVolumes = createEmptyVolumeSlots(this.slotCount);
  }

  /** Return only slots that changed since the previous world position. */
  update(
    worldX: number,
    worldY: number,
    worldZ: number,
  ): readonly VolumeChunkAssignment[] {
    const nextCenter = this.getChunkCoordinateAt(worldX, worldY, worldZ);
    if (this.isCurrentCenter(nextCenter)) return NO_VOLUME_CHANGES;

    this.centerChunkX = nextCenter.chunkX;
    this.centerChunkY = nextCenter.chunkY;
    this.centerChunkZ = nextCenter.chunkZ;
    return this.assignWindowVolumes(nextCenter);
  }

  /** Reject delayed work after its fixed slot has received a newer volume. */
  isCurrent(assignment: VolumeChunkAssignment): boolean {
    const assignedVolume = this.assignedVolumes[assignment.slotIndex];
    return (
      assignedVolume?.revision === assignment.revision &&
      assignedVolume.chunkX === assignment.chunkX &&
      assignedVolume.chunkY === assignment.chunkY &&
      assignedVolume.chunkZ === assignment.chunkZ
    );
  }

  private getChunkCoordinateAt(
    worldX: number,
    worldY: number,
    worldZ: number,
  ): VolumeChunkCoordinate {
    return {
      chunkX: Math.floor(worldX / this.chunkSize),
      chunkY: Math.floor(worldY / this.chunkSize),
      chunkZ: Math.floor(worldZ / this.chunkSize),
    };
  }

  private isCurrentCenter(coordinate: VolumeChunkCoordinate): boolean {
    return (
      this.centerChunkX === coordinate.chunkX &&
      this.centerChunkY === coordinate.chunkY &&
      this.centerChunkZ === coordinate.chunkZ
    );
  }

  /** Walk the cube as one flat list so the streaming path contains no nested loops. */
  private assignWindowVolumes(
    center: VolumeChunkCoordinate,
  ): VolumeChunkAssignment[] {
    const changedAssignments: VolumeChunkAssignment[] = [];

    for (let windowIndex = 0; windowIndex < this.slotCount; windowIndex += 1) {
      const coordinate = this.getWindowCoordinate(windowIndex, center);
      const assignment = this.assignVolumeIfChanged(coordinate);
      if (assignment) changedAssignments.push(assignment);
    }

    return changedAssignments;
  }

  /** Convert one flat index into its column, row, and vertical layer. */
  private getWindowCoordinate(
    windowIndex: number,
    center: VolumeChunkCoordinate,
  ): VolumeChunkCoordinate {
    const layer = Math.floor(windowIndex / this.chunksPerLayer);
    const indexInsideLayer = windowIndex % this.chunksPerLayer;
    const row = Math.floor(indexInsideLayer / this.chunksPerSide);
    const column = indexInsideLayer % this.chunksPerSide;

    return {
      chunkX: center.chunkX + column - this.radius,
      chunkY: center.chunkY + layer - this.radius,
      chunkZ: center.chunkZ + row - this.radius,
    };
  }

  private assignVolumeIfChanged(
    coordinate: VolumeChunkCoordinate,
  ): VolumeChunkAssignment | undefined {
    const slotIndex = getVolumeSlotIndex(coordinate, this.chunksPerSide);
    const assignedVolume = this.assignedVolumes[slotIndex];
    if (!assignedVolume || isSameCoordinate(assignedVolume, coordinate)) {
      return undefined;
    }

    assignedVolume.revision += 1;
    assignedVolume.chunkX = coordinate.chunkX;
    assignedVolume.chunkY = coordinate.chunkY;
    assignedVolume.chunkZ = coordinate.chunkZ;

    return createVolumeAssignment({
      slotIndex,
      revision: assignedVolume.revision,
      coordinate,
      chunkSize: this.chunkSize,
    });
  }
}

function createEmptyVolumeSlots(slotCount: number): AssignedVolumeChunk[] {
  return Array.from({ length: slotCount }, () => ({
    revision: 0,
    chunkX: undefined,
    chunkY: undefined,
    chunkZ: undefined,
  }));
}

function isSameCoordinate(
  assignedVolume: AssignedVolumeChunk,
  coordinate: VolumeChunkCoordinate,
): boolean {
  return (
    assignedVolume.chunkX === coordinate.chunkX &&
    assignedVolume.chunkY === coordinate.chunkY &&
    assignedVolume.chunkZ === coordinate.chunkZ
  );
}

function createVolumeAssignment({
  slotIndex,
  revision,
  coordinate,
  chunkSize,
}: VolumeAssignmentOptions): VolumeChunkAssignment {
  return {
    slotIndex,
    revision,
    ...coordinate,
    originX: coordinate.chunkX * chunkSize,
    originY: coordinate.chunkY * chunkSize,
    originZ: coordinate.chunkZ * chunkSize,
  };
}

/** Map infinite X/Y/Z coordinates onto one stable slot in the finite cube. */
function getVolumeSlotIndex(
  coordinate: VolumeChunkCoordinate,
  chunksPerSide: number,
): number {
  const slotColumn = positiveModulo(coordinate.chunkX, chunksPerSide);
  const slotRow = positiveModulo(coordinate.chunkZ, chunksPerSide);
  const slotLayer = positiveModulo(coordinate.chunkY, chunksPerSide);
  const slotsPerLayer = chunksPerSide ** 2;

  return slotLayer * slotsPerLayer + slotRow * chunksPerSide + slotColumn;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
