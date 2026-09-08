/**
 * Purpose: Prove the glider integrates heading, glide, and climb correctly.
 * Context: The horizon must never bank and the view must never pitch with
 *   altitude — the ICAROS mapping that keeps a lying visitor comfortable.
 * Responsibility: Cover yaw about world-up, level glide, and the climb rate.
 * Boundary: Frame production and precedence over the keyboard live elsewhere.
 */

import { describe, expect, test } from "bun:test";
import { Group, Vector3 } from "three";
import { FLIGHT_SETTINGS } from "../../src/control/flight-settings";
import {
  createM5Flight,
  readM5FlightInput,
} from "../../src/control/m5-flight.runtime";
import {
  type ControlFrame,
  createNeutralControl,
} from "../../src/m5/control-frame";

function liveFrame(overrides: Partial<ControlFrame> = {}): ControlFrame {
  return { ...createNeutralControl(), quality: 1, ...overrides };
}

describe("m5 flight", () => {
  test("uses the confirmed shared flight tuning", () => {
    expect(FLIGHT_SETTINGS.glideSpeedMetersPerSecond).toBe(5);
    expect(FLIGHT_SETTINGS.neutralDescentMetersPerSecond).toBe(1);
  });

  test("glides at the configured speed with the neutral descent bias", () => {
    const rig = new Group();
    const applyM5Flight = createM5Flight(rig);

    applyM5Flight(liveFrame(), 1);

    expect(rig.position.x).toBeCloseTo(0);
    expect(rig.position.y).toBeCloseTo(
      -FLIGHT_SETTINGS.neutralDescentMetersPerSecond,
    );
    expect(rig.position.z).toBeCloseTo(
      -FLIGHT_SETTINGS.glideSpeedMetersPerSecond,
    );
  });

  test.each([-0.5, 0.5])(
    "roll %s yaws exactly and holds a level heading",
    (roll) => {
      const rig = new Group();
      const applyM5Flight = createM5Flight(rig);

      applyM5Flight(liveFrame({ roll }), 1);

      const forward = flightForward(rig);
      const yawRadians = roll * FLIGHT_SETTINGS.yawRateRadiansPerSecond;
      expect(forward.x).toBeCloseTo(-Math.sin(yawRadians));
      expect(forward.z).toBeCloseTo(-Math.cos(yawRadians));
      expect(forward.y).toBeCloseTo(0);
      // No banking: the rig's up stays world-up.
      const up = new Vector3(0, 1, 0).applyQuaternion(rig.quaternion);
      expect(up.x).toBeCloseTo(0);
      expect(up.y).toBeCloseTo(1);
      expect(up.z).toBeCloseTo(0);
      applyM5Flight(liveFrame(), 1);
      expect(flightForward(rig).distanceTo(forward)).toBeCloseTo(0);
    },
  );

  test.each([-0.5, 0.5])(
    "pitch %s changes altitude without pitching the view",
    (pitch) => {
      const rig = new Group();
      const applyM5Flight = createM5Flight(rig);

      applyM5Flight(liveFrame({ pitch }), 1);

      expect(rig.position.y).toBeCloseTo(
        -pitch * FLIGHT_SETTINGS.climbRateMetersPerSecond -
          FLIGHT_SETTINGS.neutralDescentMetersPerSecond,
      );
      expect(flightForward(rig).y).toBeCloseTo(0);
    },
  );
});

function flightForward(rig: Group): Vector3 {
  return new Vector3(0, 0, -1).applyQuaternion(rig.quaternion);
}

test("tutorial intention agrees with actual flight direction", () => {
  const input = { turnRight: 0, climb: 0 };
  const frame = liveFrame({ roll: -0.7, pitch: -0.6 });
  readM5FlightInput(frame, input);
  expect(input).toEqual({ turnRight: 0.7, climb: 0.6 });
  const rig = new Group();
  const applyM5Flight = createM5Flight(rig);
  applyM5Flight(frame, 0.1);
  expect(flightForward(rig).x).toBeGreaterThan(0);
  expect(rig.position.y).toBeGreaterThan(0);
});
