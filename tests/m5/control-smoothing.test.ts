/**
 * Purpose: Prove the smoother eases live poses and never delays neutral.
 * Context: The 0.25 factor turns a 0.4 step into 0.1 on the first frame —
 *   a resumed stream must not snap, but neutral must land immediately.
 * Responsibility: Cover the ease-up, the immediate neutral, and the reset.
 * Boundary: When smoothing is skipped (neutralizer holding zero) is the
 *   control source's decision.
 */

import { describe, expect, it } from "bun:test";
import {
  type ControlFrame,
  createNeutralControl,
} from "../../src/m5/control-frame";
import { createControlSmoother } from "../../src/m5/control-smoothing";

function liveFrame(overrides: Partial<ControlFrame> = {}): ControlFrame {
  return { ...createNeutralControl(), quality: 1, ...overrides };
}

describe("control smoothing", () => {
  it("eases up from neutral instead of jumping to the live pose", () => {
    const smoother = createControlSmoother();

    expect(smoother.apply(liveFrame({ pitch: 0.4, roll: -0.4 }))).toEqual(
      liveFrame({ pitch: 0.1, roll: -0.1 }),
    );
  });

  it("lets a neutral control land immediately", () => {
    const smoother = createControlSmoother();
    smoother.apply(liveFrame({ pitch: 0.8 }));

    const neutral = createNeutralControl();
    expect(smoother.apply(neutral)).toEqual(neutral);
    // After the reset the next live pose eases from true zero, not the
    // stale pre-dropout pose.
    expect(smoother.apply(liveFrame({ pitch: 0.4 }))).toEqual(
      liveFrame({ pitch: 0.1 }),
    );
  });
});
