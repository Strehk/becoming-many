/**
 * Purpose: Prove the glider integrates heading, glide, and climb correctly.
 * Context: The horizon must never bank and the view must never pitch with
 *   altitude — the ICAROS mapping that keeps a lying visitor comfortable.
 * Responsibility: Cover yaw about world-up, level glide, and the climb rate.
 * Boundary: Frame production and precedence over the keyboard live elsewhere.
 */

import { describe, expect, test } from "bun:test";
import { Group, Vector3 } from "three";
import { applyM5Flight } from "../../src/control/m5-flight";
import {
  type ControlFrame,
  createNeutralControl,
} from "../../src/m5/control-frame";

function liveFrame(overrides: Partial<ControlFrame> = {}): ControlFrame {
  return { ...createNeutralControl(), quality: 1, ...overrides };
}

describe("m5 flight", () => {
  test("glides level along the rig heading at neutral tilt", () => {
    const rig = new Group();

    applyM5Flight(rig, liveFrame(), 1);

    // The rig heads down -Z from the origin; one second of glide moves
    // one GLIDE_SPEED along it and nothing else.
    expect(rig.position.x).toBeCloseTo(0);
    expect(rig.position.y).toBeCloseTo(0);
    expect(rig.position.z).toBeLessThan(0);
  });

  test("roll yaws the heading without banking or pitching the view", () => {
    const rig = new Group();

    applyM5Flight(rig, liveFrame({ roll: 0.5 }), 1);

    const forward = flightForward(rig);
    // The heading turned out of the -Z axis but stayed level.
    expect(Math.abs(forward.x)).toBeGreaterThan(0.01);
    expect(forward.y).toBeCloseTo(0);
    // No banking: the rig's up stays world-up.
    const up = new Vector3(0, 1, 0).applyQuaternion(rig.quaternion);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(1);
    expect(up.z).toBeCloseTo(0);
  });

  test("pull-back climbs without pitching the view", () => {
    const rig = new Group();

    // Negative frame pitch is pull-back after the single polarity flip.
    applyM5Flight(rig, liveFrame({ pitch: -0.5 }), 1);

    expect(rig.position.y).toBeGreaterThan(0);
    const forward = flightForward(rig);
    expect(forward.y).toBeCloseTo(0);
  });

  test("heading persists after the roll returns to zero", () => {
    const rig = new Group();

    applyM5Flight(rig, liveFrame({ roll: 0.5 }), 1);
    const turnedForward = flightForward(rig);
    applyM5Flight(rig, liveFrame(), 1);

    expect(flightForward(rig).x).toBeCloseTo(turnedForward.x);
  });
});

function flightForward(rig: Group): Vector3 {
  return new Vector3(0, 0, -1).applyQuaternion(rig.quaternion);
}
