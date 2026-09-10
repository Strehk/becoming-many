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
  test("keeps moving with neutral input and without connected sources", () => {
    const rig = new Group();
    const flight = createFlightControl(rig, []);

    flight.update(1);
    flight.update(1);

    expect(rig.position.x).toBeCloseTo(0);
    expect(rig.position.y).toBeCloseTo(
      -2 * FLIGHT_SETTINGS.neutralDescentMetersPerSecond,
    );
    expect(rig.position.z).toBeCloseTo(
      -2 * FLIGHT_SETTINGS.glideSpeedMetersPerSecond,
    );
  });

  test("applies optional glide speed without changing steering", () => {
    const tutorialRig = new Group();
    const mainRig = new Group();
    const source = fixedSource({ rightTilt: 0.3, forwardTilt: 0.2 });

    createFlightControl(tutorialRig, [source]).update(1, 2);
    createFlightControl(mainRig, [source]).update(1);

    expect(
      Math.hypot(tutorialRig.position.x, tutorialRig.position.z),
    ).toBeCloseTo(2);
    expect(tutorialRig.position.y).toBeCloseTo(mainRig.position.y);
    expect(tutorialRig.quaternion.angleTo(mainRig.quaternion)).toBeCloseTo(0);
  });

  test.each([-0.5, 0.5])(
    "rightTilt %s yaws exactly and holds a level heading",
    (rightTilt) => {
      const rig = new Group();
      const flight = createFlightControl(rig, [
        fixedSource({ forwardTilt: 0, rightTilt }),
      ]);

      flight.update(1);

      const forward = flightForward(rig);
      const yawRadians = -rightTilt * FLIGHT_SETTINGS.yawRateRadiansPerSecond;
      expect(forward.x).toBeCloseTo(-Math.sin(yawRadians));
      expect(forward.z).toBeCloseTo(-Math.cos(yawRadians));
      expect(forward.y).toBeCloseTo(0);
      const up = new Vector3(0, 1, 0).applyQuaternion(rig.quaternion);
      expect(up.toArray()).toEqual([0, 1, 0]);
    },
  );

  test.each([-0.5, 0.5])(
    "forwardTilt %s changes altitude without pitching the view",
    (forwardTilt) => {
      const rig = new Group();
      createFlightControl(rig, [
        fixedSource({ forwardTilt, rightTilt: 0 }),
      ]).update(1);

      expect(rig.position.y).toBeCloseTo(
        -forwardTilt * FLIGHT_SETTINGS.climbRateMetersPerSecond -
          FLIGHT_SETTINGS.neutralDescentMetersPerSecond,
      );
      expect(flightForward(rig).y).toBeCloseTo(0);
    },
  );

  test("combines every connected source and clamps each summed axis", () => {
    const reads = [0, 0, 0];
    const sources: FlightInputSource[] = [
      countingSource(reads, 0, { forwardTilt: 0, rightTilt: 0 }),
      countingSource(reads, 1, { forwardTilt: 0.75, rightTilt: 0.75 }),
      countingSource(reads, 2, { forwardTilt: 0.75, rightTilt: -0.25 }),
    ];
    const rig = new Group();

    createFlightControl(rig, sources).update(1);

    expect(reads).toEqual([1, 1, 1]);
    expect(rig.position.y).toBeCloseTo(
      -FLIGHT_SETTINGS.climbRateMetersPerSecond -
        FLIGHT_SETTINGS.neutralDescentMetersPerSecond,
    );
    expect(flightForward(rig).x).toBeCloseTo(
      Math.sin(0.5 * FLIGHT_SETTINGS.yawRateRadiansPerSecond),
    );
  });

  test("maps M5 raw axes and represents configured stale input as neutral", () => {
    let frame = { ...createNeutralControl(), pitch: 0.4, roll: -0.25 };
    const source = createM5Controller({ consumeFrame: () => frame });

    expect(source.readInput(0)).toEqual({ forwardTilt: 0.4, rightTilt: 0.25 });
    frame = createNeutralControl();
    expect(source.readInput(0)).toEqual({ forwardTilt: 0, rightTilt: 0 });

    const inactive = createM5Controller({
      consumeFrame: () => undefined,
    });
    expect(inactive.readInput(0)).toEqual({ forwardTilt: 0, rightTilt: 0 });
  });

  test("lets desktop tilt contribute beside neutral configured M5 input", () => {
    const m5 = createM5Controller({
      consumeFrame: () => createNeutralControl(),
    });
    const desktop = fixedSource({ forwardTilt: -0.5, rightTilt: 0.25 });
    const rig = new Group();

    createFlightControl(rig, [m5, desktop]).update(1);

    expect(rig.position.y).toBeCloseTo(
      0.5 * FLIGHT_SETTINGS.climbRateMetersPerSecond -
        FLIGHT_SETTINGS.neutralDescentMetersPerSecond,
    );
    expect(flightForward(rig).x).toBeGreaterThan(0);
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
