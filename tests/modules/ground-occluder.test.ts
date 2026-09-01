/**
 * Purpose: Verify the invisible ground hides what stands behind it.
 * Context: The Scent World keeps every source object unseen but must still occlude.
 * Responsibility: Cover the depth-only material and the coarse authored resolution.
 * Boundary: Streaming and geometry generation are covered by the Terrain tests.
 */

import { expect, test } from "bun:test";
import {
  createGroundOccluder,
  GROUND_OCCLUDER_SEGMENTS_PER_SIDE,
} from "../../src/modules/terrain/ground-occluder";

test("the ground occluder writes depth but never color", () => {
  const occluder = createGroundOccluder();

  // Writing no color is what keeps "the terrain remains invisible" true.
  expect(occluder.material.colorWrite).toBe(false);
  // Writing depth is what stops a ridge showing its own far side.
  expect(occluder.material.depthWrite).toBe(true);
  expect(occluder.material.depthTest).toBe(true);
  // Opaque, so it lands in the pass that fills the depth buffer.
  expect(occluder.material.transparent).toBe(false);

  occluder.material.dispose();
});

test("the occluder is coarser than a drawn surface", () => {
  const occluder = createGroundOccluder();

  expect(occluder.segmentsPerSide).toBe(GROUND_OCCLUDER_SEGMENTS_PER_SIDE);
  expect(GROUND_OCCLUDER_SEGMENTS_PER_SIDE).toBeLessThan(32);
  // It is never seen, so it carries no sampled conditions and no update.
  expect(occluder.conditionsAt).toBeUndefined();
  expect(occluder.update).toBeUndefined();

  occluder.material.dispose();
});
