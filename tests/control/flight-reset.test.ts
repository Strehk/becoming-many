import { expect, test } from "bun:test";
import { Quaternion, Vector3 } from "three";
import { createFlightControl } from "../../src/control/flight-control";
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

test("a flight reset leaves no previous tilt or turn response behind", () => {
  const position = new Vector3();
  const quaternion = new Quaternion();
  const input = { forwardTilt: 0.5, rightTilt: 0.5 };
  const flight = createFlightControl({ position, quaternion }, [
    { readInput: () => input },
  ]);
  flight.update(1);
  resetFlightPose(position, quaternion);
  input.forwardTilt = 0;
  input.rightTilt = 0;
  flight.update(1);
  expect(position.toArray()).toEqual([0, 0, -5]);
  expect(quaternion.toArray()).toEqual([0, 0, 0, 1]);
});
