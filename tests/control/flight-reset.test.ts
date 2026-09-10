import { expect, test } from "bun:test";
import { Quaternion, Vector3 } from "three";
import { resetFlightPose } from "../../src/control/flight-pose";

test("flight reset restores the origin and heading and is idempotent", () => {
  const position = new Vector3(1_200, -47.5, 880);
  const quaternion = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    Math.PI / 3,
  );

  for (let reset = 0; reset < 2; reset += 1) {
    resetFlightPose(position, quaternion);
    expect(position.toArray()).toEqual([0, 0, 0]);
    expect(quaternion.toArray()).toEqual([0, 0, 0, 1]);
  }
});
