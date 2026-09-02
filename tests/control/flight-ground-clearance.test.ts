/**
 * Purpose: Verify terrain-relative flight height limits.
 * Context: Camera movement may cross uneven terrain within a single frame.
 * Responsibility: Cover ground sampling and lower and upper vertical clamping.
 * Boundary: Browser input, terrain rendering, and physical PICO behavior stay elsewhere.
 */

import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { keepFlightWithinHeightLimits } from "../../src/control/flight-ground-clearance";

const HEIGHT_LIMITS = {
  minimumGroundClearanceMeters: 1,
  maximumGroundClearanceMeters: 50,
};

describe("flight ground clearance", () => {
  test("clamps flight to one metre above the ground at its current position", () => {
    const position = new Vector3(12, -5, -4);
    const sampledPositions: Array<readonly [number, number]> = [];

    keepFlightWithinHeightLimits(
      position,
      (worldX, worldZ) => {
        sampledPositions.push([worldX, worldZ]);
        return 3;
      },
      HEIGHT_LIMITS,
    );

    expect(sampledPositions).toEqual([[12, -4]]);
    expect(position).toEqual(new Vector3(12, 4, -4));
  });

  test("preserves flight between the two limits", () => {
    const position = new Vector3(2, 20, 6);

    keepFlightWithinHeightLimits(position, () => 3, HEIGHT_LIMITS);

    expect(position).toEqual(new Vector3(2, 20, 6));
  });

  test("clamps flight to the configured height above local ground", () => {
    const position = new Vector3(-7, 70, 5);

    keepFlightWithinHeightLimits(position, () => 3, HEIGHT_LIMITS);

    expect(position).toEqual(new Vector3(-7, 53, 5));
  });

  test("supports an upper limit without a lower ground clamp", () => {
    const position = new Vector3(0, -20, 0);

    keepFlightWithinHeightLimits(position, () => 3, {
      minimumGroundClearanceMeters: undefined,
      maximumGroundClearanceMeters: 50,
    });

    expect(position.y).toBe(-20);
  });
});
