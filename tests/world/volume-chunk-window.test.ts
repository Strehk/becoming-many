/**
 * Purpose: Verify fixed volumetric streaming on the shared aligned grid.
 * Context: Air Particles must recycle chunks vertically as well as horizontally.
 * Responsibility: Cover volume capacity, face recycling, revisions, and negative space.
 * Boundary: Particle generation and rendering remain module-owned tests.
 */

import { describe, expect, test } from "bun:test";
import { VolumeChunkWindow } from "../../src/world/volume-chunk-window";

describe("VolumeChunkWindow", () => {
  test("derives one fixed cubic slot pool", () => {
    const window = new VolumeChunkWindow({ level: 2, radius: 2 });

    expect(window.chunkSize).toBe(64);
    expect(window.slotCount).toBe(125);
    expect(window.update(0, 0, 0)).toHaveLength(125);
  });

  test("does nothing inside the same volume chunk", () => {
    const window = createWindow();
    window.update(0, 0, 0);

    expect(window.update(63.9, 63.9, 63.9)).toHaveLength(0);
  });

  test("recycles one square face when flying upward", () => {
    const window = createWindow();
    window.update(0, 0, 0);

    const recycledVolumes = window.update(0, 64, 0);

    expect(recycledVolumes).toHaveLength(25);
    expect(recycledVolumes.every(({ chunkY }) => chunkY === 3)).toBe(true);
  });

  test("invalidates delayed work after vertical reassignment", () => {
    const window = createWindow();
    const initialAssignments = window.update(0, 0, 0);
    const outgoingVolume = initialAssignments.find(
      ({ chunkY }) => chunkY === -2,
    );

    expect(outgoingVolume && window.isCurrent(outgoingVolume)).toBe(true);

    window.update(0, 64, 0);

    expect(outgoingVolume && window.isCurrent(outgoingVolume)).toBe(false);
  });

  test("keeps all origins aligned below world zero", () => {
    const window = new VolumeChunkWindow({ level: 1, radius: 1 });
    const assignments = window.update(-0.1, -0.1, -0.1);
    const centerVolume = assignments.find(
      ({ chunkX, chunkY, chunkZ }) =>
        chunkX === -1 && chunkY === -1 && chunkZ === -1,
    );

    expect(centerVolume?.originX).toBe(-32);
    expect(centerVolume?.originY).toBe(-32);
    expect(centerVolume?.originZ).toBe(-32);
  });
});

function createWindow(): VolumeChunkWindow {
  return new VolumeChunkWindow({ level: 2, radius: 2 });
}
