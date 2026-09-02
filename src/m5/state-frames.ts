/**
 * Purpose: Turn one polled device state into a ControlFrame with button edges.
 * Context: The device already normalized, axis-mapped, and calibrated its
 *   pitch/roll; edges must survive polling, so the payload carries monotonic
 *   press/release counters instead of trusting boolean snapshots.
 * Responsibility: Copy the pose and derive one-poll edges by diffing counters.
 * Boundary: Safety, auto-neutralize, smoothing, and latching across render
 *   frames live in their own stages.
 */

import type { ControlFrame } from "./control-frame";
import type { M5State } from "./protocol";

/**
 * Derive the frame for `next`, diffing button counters against `previous`.
 * A press-and-release between two polls advances both counters, so both edges
 * still fire. The first state after a (re)connect carries no edges — counter
 * history from before a device reboot must not read as presses.
 */
export function deriveControlFrame(
  previous: M5State | undefined,
  next: M5State,
): ControlFrame {
  return {
    pitch: next.pitch,
    roll: next.roll,
    quality: next.quality,
    buttonPressed: next.buttonPressed,
    buttonDown:
      previous !== undefined &&
      next.buttonPressCount > previous.buttonPressCount,
    buttonUp:
      previous !== undefined &&
      next.buttonReleaseCount > previous.buttonReleaseCount,
    controllerType: "m5",
  };
}
