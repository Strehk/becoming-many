/**
 * Purpose: Pin a rig resting near its neutral pose to exactly zero.
 * Context: An unattended rig drifts a little around its calibrated zero;
 *   without this the glider would slowly wander in idle.
 * Responsibility: Watch for a stable rest pose and force pitch/roll to 0 while
 *   it holds; quality and button state pass through untouched.
 * Boundary: The rest pose and windows are per-station config in
 *   m5-settings.ts; timestamps are injected so tests never sleep.
 */

import type { ControlFrame } from "./control-frame";
import { M5_SETTINGS } from "./m5-settings";

export interface AutoNeutralizer {
  /** Process one frame at `nowMilliseconds`; returns the possibly pinned frame. */
  readonly apply: (
    frame: ControlFrame,
    nowMilliseconds: number,
  ) => ControlFrame;
  /** True while the last applied frame was pinned — the smoother skips then. */
  readonly isHoldingZero: () => boolean;
}

export function createAutoNeutralizer(): AutoNeutralizer {
  let stableSinceMilliseconds: number | null = null;
  let lastFrameAtMilliseconds: number | null = null;
  let holdingZero = false;

  const resetWindow = (): void => {
    stableSinceMilliseconds = null;
    holdingZero = false;
  };

  return {
    apply(frame, nowMilliseconds) {
      if (frame.quality <= 0 || !Number.isFinite(nowMilliseconds)) {
        resetWindow();
        lastFrameAtMilliseconds = null;
        return frame;
      }

      if (
        lastFrameAtMilliseconds !== null &&
        !hasPlausibleFrameTiming(lastFrameAtMilliseconds, nowMilliseconds)
      ) {
        resetWindow();
      }
      lastFrameAtMilliseconds = nowMilliseconds;

      if (!isNearRestPose(frame)) {
        resetWindow();
        return frame;
      }

      if (stableSinceMilliseconds === null) {
        stableSinceMilliseconds = nowMilliseconds;
        return frame;
      }

      if (
        nowMilliseconds - stableSinceMilliseconds <
        M5_SETTINGS.stableDurationMilliseconds
      ) {
        return frame;
      }

      holdingZero = true;
      return { ...frame, pitch: 0, roll: 0 };
    },

    isHoldingZero() {
      return holdingZero;
    },
  };
}

function hasPlausibleFrameTiming(
  previousMilliseconds: number,
  nowMilliseconds: number,
): boolean {
  const gapMilliseconds = nowMilliseconds - previousMilliseconds;
  return (
    gapMilliseconds >= 0 &&
    gapMilliseconds <= M5_SETTINGS.maxFrameGapMilliseconds
  );
}

function isNearRestPose(frame: ControlFrame): boolean {
  return (
    Math.abs(frame.pitch - M5_SETTINGS.restPitch) <=
      M5_SETTINGS.restTolerance &&
    Math.abs(frame.roll - M5_SETTINGS.restRoll) <= M5_SETTINGS.restTolerance
  );
}
