/**
 * Purpose: Produce stable jittered candidate points inside aligned world chunks.
 * Context: Several modules need repeatable placement without sharing ecology rules.
 * Responsibility: Map flat candidate indices to absolute cells and deterministic random values.
 * Boundary: Zones, density, asset variants, rendering, and stream scheduling stay in modules.
 */

import type { ChunkAssignment } from "./chunk-system";

const RANDOM_VALUE_RANGE = 0x1_0000_0000;
const POSITION_JITTER = 0.7;

export interface ChunkCandidateGrid {
  readonly spacingMeters: number;
  readonly cellsPerSide: number;
  readonly candidateCount: number;
}

export interface ChunkCandidate {
  readonly worldX: number;
  readonly worldZ: number;
  readonly cellX: number;
  readonly cellZ: number;
}

/** Require a grid that divides a chunk exactly so neighboring chunks stay aligned. */
export function createChunkCandidateGrid(
  chunkSize: number,
  spacingMeters: number,
): ChunkCandidateGrid {
  const cellsPerSide = chunkSize / spacingMeters;
  if (!Number.isInteger(cellsPerSide) || cellsPerSide <= 0) {
    throw new RangeError(
      "Candidate spacing must divide the chunk size exactly",
    );
  }

  return {
    spacingMeters,
    cellsPerSide,
    candidateCount: cellsPerSide ** 2,
  };
}

/** Convert one flat row-major index into a stable world-space candidate. */
export function getChunkCandidate(
  assignment: ChunkAssignment,
  grid: ChunkCandidateGrid,
  seed: number,
  candidateIndex: number,
): ChunkCandidate {
  const column = candidateIndex % grid.cellsPerSide;
  const row = Math.floor(candidateIndex / grid.cellsPerSide);
  const cellX = assignment.chunkX * grid.cellsPerSide + column;
  const cellZ = assignment.chunkZ * grid.cellsPerSide + row;
  const jitterX = getCellRandom(seed, cellX, cellZ, 0) - 0.5;
  const jitterZ = getCellRandom(seed, cellX, cellZ, 1) - 0.5;

  return {
    worldX:
      assignment.originX +
      (column + 0.5 + jitterX * POSITION_JITTER) * grid.spacingMeters,
    worldZ:
      assignment.originZ +
      (row + 0.5 + jitterZ * POSITION_JITTER) * grid.spacingMeters,
    cellX,
    cellZ,
  };
}

/** Return one stateless random value in [0, 1) for an absolute candidate cell. */
export function getCellRandom(
  seed: number,
  cellX: number,
  cellZ: number,
  valueIndex: number,
): number {
  let hash = Math.imul(seed, 1_103_515_245);
  hash ^= Math.imul(cellX, 73_856_093);
  hash ^= Math.imul(cellZ, 19_349_663);
  hash ^= Math.imul(valueIndex + 1, 83_492_791);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);
  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}
