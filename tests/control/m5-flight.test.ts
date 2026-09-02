/**
 * Purpose: Prove the glider integrates heading, glide, and climb correctly.
 * Context: The horizon must never bank and the view must never pitch with
 *   altitude — the ICAROS mapping that keeps a lying visitor comfortable.
 * Responsibility: Cover yaw about world-up, level glide, and the climb rate.
 * Boundary: Frame production and precedence over the keyboard live elsewhere.
 */

import { describe, expect, test } from "bun:test";
import { PerspectiveCamera, Vector3 } from "three";
import { applyM5Flight } from "../../src/control/m5-flight";
import {
  type ControlFrame,
  createNeutralControl,
} from "../../src/m5/control-frame";

function liveFrame(overrides: Partial<ControlFrame> = {}): ControlFrame {
  return { ...createNeutralControl(), quality: 1, ...overrides };
}

describe("m5 flight", () => {
  test("glides level along the view direction at neutral tilt", () => {
    const camera = new PerspectiveCamera();

    applyM5Flight(camera, liveFrame(), 1);

    // The camera looks down -Z from the origin; one second of glide moves
    // one GLIDE_SPEED along it and nothing else.
    expect(camera.position.x).toBeCloseTo(0);
    expect(camera.position.y).toBeCloseTo(0);
    expect(camera.position.z).toBeLessThan(0);
  });

  test("roll yaws the heading without banking or pitching the view", () => {
    const camera = new PerspectiveCamera();

    applyM5Flight(camera, liveFrame({ roll: 0.5 }), 1);

    const forward = camera.getWorldDirection(new Vector3());
    // The heading turned out of the -Z axis but stayed level.
    expect(Math.abs(forward.x)).toBeGreaterThan(0.01);
    expect(forward.y).toBeCloseTo(0);
    // No banking: the camera's up stays world-up.
    const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(1);
    expect(up.z).toBeCloseTo(0);
  });

  test("pull-back climbs without pitching the view", () => {
    const camera = new PerspectiveCamera();

    // Negative frame pitch is pull-back after the single polarity flip.
    applyM5Flight(camera, liveFrame({ pitch: -0.5 }), 1);

    expect(camera.position.y).toBeGreaterThan(0);
    const forward = camera.getWorldDirection(new Vector3());
    expect(forward.y).toBeCloseTo(0);
  });

  test("heading persists after the roll returns to zero", () => {
    const camera = new PerspectiveCamera();

    applyM5Flight(camera, liveFrame({ roll: 0.5 }), 1);
    const turnedForward = camera.getWorldDirection(new Vector3()).clone();
    applyM5Flight(camera, liveFrame(), 1);

    expect(camera.getWorldDirection(new Vector3()).x).toBeCloseTo(
      turnedForward.x,
    );
  });
});
