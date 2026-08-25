/**
 * Purpose: Verify the reusable chunk window and shared grid hierarchy.
 * Context: Every streamed module depends on stable coordinates and slot revisions.
 * Responsibility: Cover sizes, dynamic radii, recycling, revisions, and negative space.
 * Boundary: Module-specific generation and rendering are tested by their owners.
 */

import { describe, expect, test } from "bun:test";
import {
  BASE_CHUNK_SIZE,
  type ChunkAssignment,
  ChunkWindow,
} from "../../src/world/chunk-system";

describe("ChunkWindow", () => {
  test("uses power-of-two multiples of the base grid", () => {
    expect(createWindow(0, 1).chunkSize).toBe(BASE_CHUNK_SIZE);
    expect(createWindow(1, 1).chunkSize).toBe(32);
    expect(createWindow(2, 1).chunkSize).toBe(64);
    expect(createWindow(3, 1).chunkSize).toBe(128);
  });

  test("derives a fixed slot pool from the configured radius", () => {
    expect(createWindow(0, 1).slotCount).toBe(9);
    expect(createWindow(0, 2).slotCount).toBe(25);
  });

  test("assigns every slot exactly once around the initial position", () => {
    const chunkWindow = createWindow(0, 2);
    const assignments = chunkWindow.update(0, 0);

    expect(assignments).toHaveLength(25);
    expect(uniqueSlotCount(assignments)).toBe(25);
  });

  test("does nothing while the center remains in the same chunk", () => {
    const chunkWindow = createWindow(0, 2);
    chunkWindow.update(0, 0);

    expect(chunkWindow.update(15.9, 15.9)).toHaveLength(0);
  });

  test("recycles only one column after crossing one boundary", () => {
    const chunkWindow = createWindow(0, 2);
    chunkWindow.update(0, 0);

    const recycledChunks = chunkWindow.update(16, 0);

    expect(recycledChunks).toHaveLength(5);
    expect(recycledChunks.every(({ chunkX }) => chunkX === 3)).toBe(true);
  });

  test("invalidates delayed work when its slot is reassigned", () => {
    const chunkWindow = createWindow(0, 1);
    const initialAssignments = chunkWindow.update(0, 0);
    const outgoingChunk = initialAssignments.find(
      ({ chunkX }) => chunkX === -1,
    );

    expect(outgoingChunk).toBeDefined();
    expect(outgoingChunk && chunkWindow.isCurrent(outgoingChunk)).toBe(true);

    chunkWindow.update(16, 0);

    expect(outgoingChunk && chunkWindow.isCurrent(outgoingChunk)).toBe(false);
  });

  test("keeps origins aligned in negative world space", () => {
    const chunkWindow = createWindow(1, 1);
    const assignments = chunkWindow.update(-0.1, -0.1);
    const centerChunk = assignments.find(
      ({ chunkX, chunkZ }) => chunkX === -1 && chunkZ === -1,
    );

    expect(centerChunk?.originX).toBe(-32);
    expect(centerChunk?.originZ).toBe(-32);
  });
});

function createWindow(level: 0 | 1 | 2 | 3, radius: number): ChunkWindow {
  return new ChunkWindow({ level, radius });
}

function uniqueSlotCount(assignments: readonly ChunkAssignment[]): number {
  return new Set(assignments.map(({ slotIndex }) => slotIndex)).size;
}
