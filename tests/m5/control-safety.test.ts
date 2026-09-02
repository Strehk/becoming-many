/**
 * Purpose: Prove implausible poses flatten to neutral and edges survive it.
 * Context: A person lies on the machine; the limits come from the previous
 *   stack's rig tuning (resume at 0.85, step at 0.9).
 * Responsibility: Cover the resume, step, and pass-through branches.
 * Boundary: Rest-pose pinning belongs to the auto-neutralize tests.
 */

import { describe, expect, it } from "bun:test";
import {
  type ControlFrame,
  createNeutralControl,
} from "../../src/m5/control-frame";
import { protectControl } from "../../src/m5/control-safety";

function liveFrame(overrides: Partial<ControlFrame> = {}): ControlFrame {
  return { ...createNeutralControl(), quality: 1, ...overrides };
}

describe("control safety", () => {
  it("keeps a controller that reconnects at an extreme angle neutral", () => {
    const previous = createNeutralControl();
    const next = liveFrame({ pitch: 0.9, roll: 0.1 });

    expect(protectControl(previous, next)).toEqual(createNeutralControl());
  });

  it("flattens an abrupt outlier step but keeps the button edge", () => {
    const previous = liveFrame({ pitch: 0.1 });
    const next = liveFrame({
      pitch: -0.85,
      buttonDown: true,
      buttonPressed: true,
    });

    expect(protectControl(previous, next)).toEqual({
      ...createNeutralControl(),
      buttonPressed: true,
      buttonDown: true,
    });
  });

  it("lets a plausible movement through untouched", () => {
    const previous = liveFrame({ pitch: 0.2, roll: -0.1 });
    const next = liveFrame({ pitch: 0.4, roll: -0.3 });

    expect(protectControl(previous, next)).toEqual(next);
  });

  it("neutralizes a quality-zero frame while keeping its button state", () => {
    const previous = liveFrame({ pitch: 0.5 });
    const next: ControlFrame = {
      ...createNeutralControl(),
      pitch: 0.5,
      buttonUp: true,
    };

    expect(protectControl(previous, next)).toEqual({
      ...createNeutralControl(),
      buttonUp: true,
    });
  });
});
