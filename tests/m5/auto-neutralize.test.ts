/**
 * Purpose: Prove the rest pose pins to zero only after a stable, unbroken window.
 * Context: The rig rests at its calibrated zero; the neutralizer stops idle
 *   drift from slowly flying the glider into the ground.
 * Responsibility: Cover the window, its resets, and what the stage never touches.
 * Boundary: The rest pose and windows come from M5_SETTINGS; timestamps are
 *   injected, so no test sleeps.
 */

import { describe, expect, it } from "bun:test";
import {
  type AutoNeutralizer,
  createAutoNeutralizer,
} from "../../src/m5/auto-neutralize";
import {
  type ControlFrame,
  createNeutralControl,
} from "../../src/m5/control-frame";
import { M5_SETTINGS } from "../../src/m5/m5-settings";

const REST_FRAME: ControlFrame = {
  ...createNeutralControl(),
  pitch: M5_SETTINGS.restPitch + 0.02,
  roll: M5_SETTINGS.restRoll - 0.02,
  quality: 1,
};

const PINNED_REST_FRAME: ControlFrame = { ...REST_FRAME, pitch: 0, roll: 0 };
const WINDOW = M5_SETTINGS.stableDurationMilliseconds;
// The poll cadence the stream arrives at; the gap guard tolerates it easily.
const STEP = 100;

/** Feed the rest pose from `fromMs` to `toMs` inclusive and return the last result. */
function holdRest(
  neutralizer: AutoNeutralizer,
  fromMilliseconds: number,
  toMilliseconds: number,
): ControlFrame {
  let latest = REST_FRAME;
  for (let now = fromMilliseconds; now <= toMilliseconds; now += STEP) {
    latest = neutralizer.apply(REST_FRAME, now);
  }
  return latest;
}

describe("auto neutralize", () => {
  it("leaves a stable rest pose alone until the window completes", () => {
    const neutralizer = createAutoNeutralizer();

    expect(holdRest(neutralizer, 0, WINDOW - STEP)).toEqual(REST_FRAME);
    expect(neutralizer.isHoldingZero()).toBe(false);
  });

  it("zeroes pitch and roll after the window while preserving quality", () => {
    const neutralizer = createAutoNeutralizer();

    expect(holdRest(neutralizer, 0, WINDOW)).toEqual(PINNED_REST_FRAME);
    expect(neutralizer.isHoldingZero()).toBe(true);
  });

  it("releases as soon as the pose leaves the tolerance window", () => {
    const neutralizer = createAutoNeutralizer();
    holdRest(neutralizer, 0, WINDOW);

    const steering: ControlFrame = { ...REST_FRAME, pitch: 0.5 };
    expect(neutralizer.apply(steering, WINDOW + STEP)).toEqual(steering);
    expect(neutralizer.isHoldingZero()).toBe(false);
  });

  it("restarts the window when the signal drops out", () => {
    const neutralizer = createAutoNeutralizer();
    holdRest(neutralizer, 0, WINDOW / 2);

    const lost: ControlFrame = { ...REST_FRAME, quality: 0 };
    const dropoutAt = WINDOW / 2 + STEP;
    expect(neutralizer.apply(lost, dropoutAt)).toEqual(lost);

    // The full window must pass again after the dropout.
    const resumeAt = dropoutAt + STEP;
    expect(holdRest(neutralizer, resumeAt, resumeAt + WINDOW - STEP)).toEqual(
      REST_FRAME,
    );
    expect(holdRest(neutralizer, resumeAt + WINDOW, resumeAt + WINDOW)).toEqual(
      PINNED_REST_FRAME,
    );
  });

  it("requires an uninterrupted frame stream across the window", () => {
    const neutralizer = createAutoNeutralizer();
    holdRest(neutralizer, 0, WINDOW / 2);

    // A gap beyond maxFrameGapMilliseconds restarts the stability window.
    const afterGap = WINDOW / 2 + M5_SETTINGS.maxFrameGapMilliseconds + STEP;
    expect(holdRest(neutralizer, afterGap, afterGap + WINDOW - STEP)).toEqual(
      REST_FRAME,
    );
    expect(holdRest(neutralizer, afterGap + WINDOW, afterGap + WINDOW)).toEqual(
      PINNED_REST_FRAME,
    );
  });

  it("never neutralizes a pose that is not the rest pose", () => {
    const neutralizer = createAutoNeutralizer();
    const steering: ControlFrame = { ...REST_FRAME, roll: 0.4 };

    let latest = steering;
    for (let now = 0; now <= WINDOW * 2; now += STEP) {
      latest = neutralizer.apply(steering, now);
    }
    expect(latest).toEqual(steering);
    expect(neutralizer.isHoldingZero()).toBe(false);
  });

  it("passes button state through even while holding zero", () => {
    const neutralizer = createAutoNeutralizer();
    holdRest(neutralizer, 0, WINDOW);

    const pressed: ControlFrame = {
      ...REST_FRAME,
      buttonPressed: true,
      buttonDown: true,
    };
    expect(neutralizer.apply(pressed, WINDOW + STEP)).toEqual({
      ...pressed,
      pitch: 0,
      roll: 0,
    });
  });
});
