/**
 * Purpose: Verify a reset returns the flight to the pose a level starts from.
 * Context: The start pose is the unpositioned camera the World Runtime creates.
 * Responsibility: Prove position and orientation both return, from any pose.
 * Boundary: Ground clearance is verified beside this, against its own contract.
 */

import { describe, expect, test } from "bun:test";
import { Quaternion, Vector3 } from "three";
import { resetFlightPose } from "../../src/control/flight-reset";

describe("resetFlightPose", () => {
  test("returns the flight to the origin", () => {
    const position = new Vector3(1_200, -47.5, 880);
    const quaternion = new Quaternion();

    resetFlightPose(position, quaternion);

    expect(position.toArray()).toEqual([0, 0, 0]);
  });

  test("levels the view back to the default forward", () => {
    const position = new Vector3();
    const quaternion = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI / 3,
    );

    resetFlightPose(position, quaternion);

    expect(quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });

  test("leaves an already reset flight where it is", () => {
    const position = new Vector3();
    const quaternion = new Quaternion();

    resetFlightPose(position, quaternion);

    expect(position.toArray()).toEqual([0, 0, 0]);
    expect(quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });
});
