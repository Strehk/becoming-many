/**
 * Purpose: Verify deterministic candidate positions on the shared chunk grid.
 * Context: Vegetation and Rocks must revisit identical placements without seams.
 * Responsibility: Cover grid validation, stable values, and neighboring chunks.
 * Boundary: Zone density and visual selection remain module-specific.
 */

import { expect, test } from "bun:test";
import {
  createChunkCandidateGrid,
  getCellRandom,
  getChunkCandidate,
} from "../../src/world/chunk-candidates";

const FIRST_CHUNK = {
  slotIndex: 0,
  revision: 1,
  chunkX: 0,
  chunkZ: 0,
  originX: 0,
  originZ: 0,
} as const;

test("candidate grids must divide their chunk exactly", () => {
  expect(createChunkCandidateGrid(64, 8)).toEqual({
    spacingMeters: 8,
    cellsPerSide: 8,
    candidateCount: 64,
  });
  expect(() => createChunkCandidateGrid(64, 7)).toThrow(
    "Candidate spacing must divide the chunk size exactly",
  );
});

test("the same absolute cell always returns the same candidate", () => {
  const grid = createChunkCandidateGrid(64, 8);
  const first = getChunkCandidate(FIRST_CHUNK, grid, 42, 17);
  const repeated = getChunkCandidate(FIRST_CHUNK, grid, 42, 17);

  expect(repeated).toEqual(first);
  expect(getCellRandom(42, first.cellX, first.cellZ, 2)).toBe(
    getCellRandom(42, first.cellX, first.cellZ, 2),
  );
});

test("neighboring chunks use different absolute cells", () => {
  const grid = createChunkCandidateGrid(64, 8);
  const neighbor = {
    ...FIRST_CHUNK,
    slotIndex: 1,
    chunkX: 1,
    originX: 64,
  };

  const first = getChunkCandidate(FIRST_CHUNK, grid, 42, 0);
  const second = getChunkCandidate(neighbor, grid, 42, 0);

  expect(second.cellX).toBe(first.cellX + grid.cellsPerSide);
  expect(second.worldX).toBeGreaterThan(64);
  expect(second).not.toEqual(first);
});
