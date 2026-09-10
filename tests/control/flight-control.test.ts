/**
 * Purpose: Prove source arbitration and shared flight integration.
 * Context: Every input adapter supplies the same semantic axes to one model.
 * Responsibility: Cover neutral thrust, steering, combination, and extensibility.
 * Boundary: Browser input capture and M5 transport are tested separately.
 */

import { describe, expect, test } from "bun:test";
import { Group, Vector3 } from "three";
import type {
  FlightInput,
  FlightInputSource,
} from "../../src/control/control-contract";
import { createFlightControl } from "../../src/control/flight-control";
import { FLIGHT_SETTINGS } from "../../src/control/flight-settings";
import { createM5Controller } from "../../src/control/m5-controller";
import { createNeutralControl } from "../../src/m5/control-frame";

describe("flight control", () => {
  test("neutral input glides level without a connected source", () => {
    const rig = new Group();
    const flight = createFlightControl(rig, []);
    flight.update(1);
    flight.update(1);
    expect(rig.position.toArray()).toEqual([0, 0, -10]);
  });

  test.each([-1, -0.5, 0, 0.5, 1])(
    "tilt %s sets a held flight angle at constant path speed",
    (forwardTilt) => {
      const rig = new Group();
      const flight = createFlightControl(rig, [
        fixedSource({ forwardTilt, rightTilt: 0 }),
      ]);
      flight.update(1);
      const firstStep = rig.position.clone();
      const angle = Math.atan2(firstStep.y, -firstStep.z);
      expect(angle).toBeCloseTo((-forwardTilt * Math.PI) / 4);
      expect(firstStep.length()).toBeCloseTo(5);
      flight.update(1);
      expect(
        rig.position.distanceTo(firstStep.clone().multiplyScalar(2)),
      ).toBeCloseTo(0);
      expect(rig.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    },
  );

  test("speed scales the entire path without changing its pitch", () => {
    const slowRig = new Group();
    const normalRig = new Group();
    const source = fixedSource({ rightTilt: 0.3, forwardTilt: 0.5 });
    createFlightControl(slowRig, [source]).update(1, 2);
    createFlightControl(normalRig, [source]).update(1, 5);
    expect(
      slowRig.position.distanceTo(
        normalRig.position.clone().multiplyScalar(0.4),
      ),
    ).toBeCloseTo(0);
    expect(slowRig.quaternion.angleTo(normalRig.quaternion)).toBeCloseTo(0);
  });

  test("returning to neutral levels the path immediately without altitude drift", () => {
    const rig = new Group();
    const input = { forwardTilt: -0.5, rightTilt: 0 };
    const flight = createFlightControl(rig, [fixedSource(input)]);
    flight.update(1);
    const height = rig.position.y;
    input.forwardTilt = 0;
    flight.update(5);
    expect(rig.position.y).toBe(height);
  });

  test.each([-1, 1])(
    "right tilt %s follows a circular turn with a level rig",
    (rightTilt) => {
      const rig = new Group();
      createFlightControl(rig, [
        fixedSource({ forwardTilt: 0, rightTilt }),
      ]).update(1);
      const angle = rightTilt * FLIGHT_SETTINGS.yawRateRadiansPerSecond;
      const radius = 5 / FLIGHT_SETTINGS.yawRateRadiansPerSecond;
      expect(rig.position.x).toBeCloseTo(
        rightTilt * radius * (1 - Math.cos(angle)),
      );
      expect(rig.position.z).toBeCloseTo(-rightTilt * radius * Math.sin(angle));
      expect(flightForward(rig).x).toBeCloseTo(Math.sin(angle));
      expect(
        new Vector3(0, 1, 0).applyQuaternion(rig.quaternion).toArray(),
      ).toEqual([0, 1, 0]);
    },
  );

  test.each([30, 60, 90, 144])(
    "a held climbing turn is independent of %s Hz stepping",
    (frequency) => {
      const stepped = new Group();
      const reference = new Group();
      const source = fixedSource({ forwardTilt: -0.6, rightTilt: 0.7 });
      const flight = createFlightControl(stepped, [source]);
      createFlightControl(reference, [source]).update(4);
      for (let index = 0; index < frequency * 4; index += 1)
        flight.update(1 / frequency);
      expect(stepped.position.distanceTo(reference.position)).toBeLessThan(
        1e-10,
      );
      expect(stepped.quaternion.angleTo(reference.quaternion)).toBeLessThan(
        1e-7,
      );
    },
  );

  test("combines every source once and clamps the summed axes", () => {
    const reads = [0, 0, 0];
    const sources = [
      countingSource(reads, 0, { forwardTilt: 0, rightTilt: 0 }),
      countingSource(reads, 1, { forwardTilt: 0.75, rightTilt: 0.75 }),
      countingSource(reads, 2, { forwardTilt: 0.75, rightTilt: -0.25 }),
    ];
    const rig = new Group();
    const reference = new Group();
    createFlightControl(rig, sources).update(1);
    createFlightControl(reference, [
      fixedSource({ forwardTilt: 1, rightTilt: 0.5 }),
    ]).update(1);
    expect(reads).toEqual([1, 1, 1]);
    expect(rig.position).toEqual(reference.position);
    expect(rig.quaternion.toArray()).toEqual(reference.quaternion.toArray());
  });

  test("opposing sources cancel to level forward flight", () => {
    const rig = new Group();
    createFlightControl(rig, [
      fixedSource({ forwardTilt: 0.8, rightTilt: -0.6 }),
      fixedSource({ forwardTilt: -0.8, rightTilt: 0.6 }),
    ]).update(1);
    expect(rig.position.toArray()).toEqual([0, 0, -5]);
  });

  test("maps M5 axes and stale input without retaining flight tilt", () => {
    let frame = { ...createNeutralControl(), pitch: 0.4, roll: -0.25 };
    const source = createM5Controller({ consumeFrame: () => frame });
    expect(source.readInput(0)).toEqual({ forwardTilt: 0.4, rightTilt: 0.25 });
    const rig = new Group();
    const flight = createFlightControl(rig, [source]);
    flight.update(1);
    const height = rig.position.y;
    frame = createNeutralControl();
    flight.update(1);
    expect(rig.position.y).toBe(height);
    const inactive = createM5Controller({ consumeFrame: () => undefined });
    expect(inactive.readInput(0)).toEqual({ forwardTilt: 0, rightTilt: 0 });
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "invalid or zero frame duration %s never moves the rig",
    (duration) => {
      const rig = new Group();
      const deltas: number[] = [];
      createFlightControl(rig, [
        {
          readInput: (delta) => {
            deltas.push(delta);
            return { forwardTilt: 1, rightTilt: 1 };
          },
        },
      ]).update(duration);
      expect(deltas).toEqual([0]);
      expect(rig.position.toArray()).toEqual([0, 0, 0]);
      expect(rig.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    },
  );

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "speed %s stops translation and turning",
    (speed) => {
      const rig = new Group();
      createFlightControl(rig, [
        fixedSource({ forwardTilt: 1, rightTilt: 1 }),
      ]).update(1, speed);
      expect(rig.position.toArray()).toEqual([0, 0, 0]);
      expect(rig.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    },
  );

  test("an invalid axis cannot poison another source", () => {
    const rig = new Group();
    const reference = new Group();
    const valid = fixedSource({ forwardTilt: -0.5, rightTilt: 0.5 });
    createFlightControl(rig, [
      fixedSource({
        forwardTilt: Number.NaN,
        rightTilt: Number.POSITIVE_INFINITY,
      }),
      valid,
    ]).update(1);
    createFlightControl(reference, [valid]).update(1);
    expect(rig.position).toEqual(reference.position);
  });
});

function fixedSource(input: FlightInput): FlightInputSource {
  return { readInput: () => input };
}

function countingSource(
  reads: number[],
  index: number,
  input: FlightInput,
): FlightInputSource {
  return {
    readInput: () => {
      reads[index] = (reads[index] ?? 0) + 1;
      return input;
    },
  };
}

function flightForward(rig: Group): Vector3 {
  return new Vector3(0, 0, -1).applyQuaternion(rig.quaternion);
}
