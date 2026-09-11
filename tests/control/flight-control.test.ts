/** Verify flight direction and input arbitration; keyboard motion is tested end to end. */
import { expect, test } from "bun:test";
import { Euler, Group, Vector3 } from "three";
import type { FlightInput } from "../../src/control/control-contract";
import { createFlightControl } from "../../src/control/flight-control";

function flightWith(input: FlightInput) {
  const rig = new Group();
  return {
    rig,
    flight: createFlightControl(rig, [{ readInput: () => input }]),
  };
}

test("neutral flight moves forward at the requested speed", () => {
  const { rig, flight } = flightWith({ forwardTilt: 0, rightTilt: 0 });
  flight.update(1, 3);
  expect(rig.position.toArray()).toEqual([0, 0, -3]);
});

test.each([-0.5, 0.5])(
  "analog pitch %s tilts and travels in the same direction",
  (forwardTilt) => {
    const { rig, flight } = flightWith({ forwardTilt, rightTilt: 0 });
    flight.update(1, 5);
    const forward = new Vector3(0, 0, -1).applyQuaternion(rig.quaternion);
    expect(rig.position.y * forwardTilt).toBeLessThan(0);
    expect(rig.position.length()).toBeCloseTo(5);
    expect(rig.position.clone().normalize().distanceTo(forward)).toBeLessThan(
      1e-7,
    );
  },
);

test.each([-1, 1])(
  "side tilt %s visibly banks and turns to that side",
  (rightTilt) => {
    const { rig, flight } = flightWith({ forwardTilt: 0, rightTilt });
    flight.update(0.2);
    const pose = new Euler().setFromQuaternion(rig.quaternion, "YXZ");
    expect(pose.z * rightTilt).toBeLessThan(0);
    expect(rig.position.x * rightTilt).toBeGreaterThan(0);
    expect(rig.position.y).toBeCloseTo(0);
  },
);

test("combines sources once, clamps axes, and cancels opposing input", () => {
  let reads = 0;
  const rig = new Group();
  const source = {
    readInput: () => {
      reads++;
      return { forwardTilt: 0.8, rightTilt: 0.8 };
    },
  };
  createFlightControl(rig, [source, source]).update(0.1);
  const reference = flightWith({ forwardTilt: 1, rightTilt: 1 });
  reference.flight.update(0.1);
  expect(reads).toBe(2);
  expect(rig.position).toEqual(reference.rig.position);
  const neutral = new Group();
  createFlightControl(neutral, [
    source,
    { readInput: () => ({ forwardTilt: -0.8, rightTilt: -0.8 }) },
  ]).update(1);
  expect(neutral.position.x).toBeCloseTo(0);
  expect(neutral.position.y).toBeCloseTo(0);
  expect(neutral.position.z).toBeLessThan(0);
});

test("invalid time, speed and input cannot poison the rig", () => {
  const { rig, flight } = flightWith({
    forwardTilt: Number.NaN,
    rightTilt: Infinity,
  });
  for (const duration of [0, -1, Number.NaN, Infinity]) flight.update(duration);
  for (const speed of [0, -1, Number.NaN, Infinity]) flight.update(1, speed);
  expect(rig.position.toArray()).toEqual([0, 0, 0]);
  flight.update(1);
  expect(rig.position.toArray()).toEqual([0, 0, -5]);
});
