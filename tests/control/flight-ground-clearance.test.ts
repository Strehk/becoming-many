/**
 * Purpose: Verify the minimum ground clearance applied to flight navigation.
 * Context: Camera movement may cross uneven terrain within a single frame.
 * Responsibility: Cover ground sampling, vertical clamping, and unrestricted ascent.
 * Boundary: Browser input, terrain rendering, and physical PCVR behavior stay elsewhere.
 */

import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { keepFlightAboveGround } from "../../src/control/flight-ground-clearance";

describe("flight ground clearance", () => {
  test("clamps flight to one metre above the ground at its current position", () => {
    const position = new Vector3(12, -5, -4);
    const sampledPositions: Array<readonly [number, number]> = [];

    keepFlightAboveGround(position, (worldX, worldZ) => {
      sampledPositions.push([worldX, worldZ]);
      return 3;
    });

    expect(sampledPositions).toEqual([[12, -4]]);
    expect(position).toEqual(new Vector3(12, 4, -4));
  });

  test("preserves unrestricted flight above the minimum clearance", () => {
    const position = new Vector3(2, 20, 6);

    keepFlightAboveGround(position, () => 3);

    expect(position).toEqual(new Vector3(2, 20, 6));
  });
});
