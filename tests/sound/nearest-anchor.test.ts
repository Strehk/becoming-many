/**
 * Purpose: Verify how a placed voice finds the cloud it sounds from.
 * Context: Placement scans packed world positions every frame, so it writes
 *   into a scratch point and reports whether it found anything at all.
 * Responsibility: Cover the empty world, the nearest pick, and the packing.
 * Boundary: The gliding that follows the pick belongs to the organ runtime.
 */

import { describe, expect, test } from "bun:test";
import {
  type AnchorPoint,
  readNearestAnchor,
} from "../../src/sound/drone-organ/nearest-anchor";

const LISTENER = { x: 0, y: 0, z: 0 };

function scratch(): AnchorPoint {
  return { x: Number.NaN, y: Number.NaN, z: Number.NaN };
}

describe("readNearestAnchor", () => {
  test("reports an empty group and leaves the point alone", () => {
    const out = scratch();
    expect(readNearestAnchor(new Float32Array(0), LISTENER, out)).toBe(false);
    expect(Number.isNaN(out.x)).toBe(true);
  });

  test("picks the closest cloud in three dimensions", () => {
    const points = new Float32Array([0, 40, 0, 12, 0, 0, 0, 0, 30]);
    const out = scratch();

    expect(readNearestAnchor(points, LISTENER, out)).toBe(true);
    expect([out.x, out.y, out.z]).toEqual([12, 0, 0]);
  });

  test("measures from the listener, not from the origin", () => {
    const points = new Float32Array([0, 0, 0, 100, 0, 0]);
    const out = scratch();

    expect(readNearestAnchor(points, { x: 90, y: 0, z: 0 }, out)).toBe(true);
    expect(out.x).toBe(100);
  });

  test("ignores a trailing value that is not a whole point", () => {
    const points = new Float32Array([10, 0, 0, 1]);
    const out = scratch();

    expect(readNearestAnchor(points, LISTENER, out)).toBe(true);
    expect([out.x, out.y, out.z]).toEqual([10, 0, 0]);
  });
});
