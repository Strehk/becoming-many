/**
 * Purpose: Ease each new controller pose so a resumed stream never snaps.
 * Context: The device is polled at ~6Hz; without easing, a reconnect or a
 *   dropped-and-recovered signal would jump the flight in one frame.
 * Responsibility: Lerp pitch/roll toward each new frame; a neutral frame lands
 *   immediately and resets the easing origin to true zero.
 * Boundary: The factor is per-station config in m5-settings.ts; when to skip
 *   smoothing (while the neutralizer holds zero) is the composer's call.
 */

import type { ControlFrame } from "./control-frame";
import { M5_SETTINGS } from "./m5-settings";

export interface ControlSmoother {
  readonly apply: (frame: ControlFrame) => ControlFrame;
}

export function createControlSmoother(): ControlSmoother {
  let previousPitch = 0;
  let previousRoll = 0;

  return {
    apply(frame) {
      // Neutral must land immediately, never fade in — and the next live
      // frame eases up from true zero rather than from a stale pose.
      if (frame.quality <= 0) {
        previousPitch = 0;
        previousRoll = 0;
        return frame;
      }

      const pitch = lerp(
        previousPitch,
        frame.pitch,
        M5_SETTINGS.smoothingFactor,
      );
      const roll = lerp(previousRoll, frame.roll, M5_SETTINGS.smoothingFactor);
      previousPitch = pitch;
      previousRoll = roll;
      return { ...frame, pitch, roll };
    },
  };
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
