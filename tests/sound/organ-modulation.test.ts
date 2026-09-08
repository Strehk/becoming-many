/**
 * Purpose: Verify the patch chain the organ's live controls hang on.
 * Context: A world signal is read, mapped into a control range, and smoothed;
 *   all three steps are pure and none of them needs an audio context.
 * Responsibility: Cover the two signals and the cable that carries them.
 * Boundary: What a control does to a voice belongs to the voice.
 */

import { describe, expect, test } from "bun:test";
import {
  type ListenerPose,
  readOrganSignal,
} from "../../src/sound/drone-organ/organ-signals";
import { createModulation } from "../../src/sound/drone-organ/signal-modulation";

function poseAt(y: number, yawRadians = 0): ListenerPose {
  return { x: 0, y, z: 0, yawRadians, pitchRadians: 0 };
}

describe("readOrganSignal", () => {
  test("reads height as the climb above the ground under the visitor", () => {
    expect(readOrganSignal("altitude", poseAt(10), 10)).toBe(0);
    expect(readOrganSignal("altitude", poseAt(40), 10)).toBeCloseTo(0.5, 6);
  });

  test("saturates height rather than running past its control", () => {
    expect(readOrganSignal("altitude", poseAt(400), 0)).toBe(1);
    expect(readOrganSignal("altitude", poseAt(-5), 0)).toBe(0);
  });

  test("reads the compass without the cliff a course would have", () => {
    expect(readOrganSignal("north", poseAt(0, 0), 0)).toBeCloseTo(1, 6);
    expect(readOrganSignal("north", poseAt(0, Math.PI), 0)).toBeCloseTo(0, 6);
    expect(readOrganSignal("north", poseAt(0, Math.PI / 2), 0)).toBeCloseTo(
      0.5,
      6,
    );
    // The seam a course would open: both sides of north read the same.
    expect(readOrganSignal("north", poseAt(0, -0.01), 0)).toBeCloseTo(
      readOrganSignal("north", poseAt(0, 0.01), 0),
      6,
    );
  });
});

describe("createModulation", () => {
  const range = { source: "altitude", minimum: 0.2, maximum: 0.8 } as const;

  test("arrives at its value instead of ramping up from nothing", () => {
    const modulation = createModulation({ ...range, smoothing: 0.9 });
    expect(modulation.follow(0.5)).toBeCloseTo(0.5, 6);
  });

  test("maps the signal into the authored range", () => {
    const modulation = createModulation({ ...range, smoothing: 0 });
    expect(modulation.follow(0)).toBeCloseTo(0.2, 6);
    expect(modulation.follow(1)).toBeCloseTo(0.8, 6);
  });

  test("holds back a jump and closes on it", () => {
    const modulation = createModulation({
      source: "altitude",
      minimum: 0,
      maximum: 1,
      smoothing: 0.4,
    });
    modulation.follow(0);

    const first = modulation.follow(1);
    const second = modulation.follow(1);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThan(1);
  });

  test("never leaves the control range, however it is patched", () => {
    const modulation = createModulation({
      source: "north",
      minimum: 1,
      maximum: 0, // Inverted on purpose: the cable may run either way.
      smoothing: 0,
    });
    expect(modulation.follow(0)).toBe(1);
    expect(modulation.follow(1)).toBe(0);
  });
});
