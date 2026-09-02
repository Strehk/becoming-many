/**
 * Purpose: Flatten implausible or unsafe controller poses to neutral.
 * Context: A person lies on the machine — a controller that reconnects at an
 *   extreme angle or jumps in a single poll must not steer the flight.
 * Responsibility: Gate each new frame against the previous one; button edges
 *   always pass through.
 * Boundary: What counts as extreme is per-station config in m5-settings.ts;
 *   rest-pose handling belongs to auto-neutralize.
 */

import { type ControlFrame, createNeutralControl } from "./control-frame";
import { M5_SETTINGS } from "./m5-settings";

export function protectControl(
  previous: ControlFrame,
  next: ControlFrame,
): ControlFrame {
  if (next.quality <= 0) {
    return neutralKeepingButton(next);
  }

  if (previous.quality <= 0 && isExtreme(next)) {
    return neutralKeepingButton(next);
  }

  if (previous.quality > 0 && hasAbruptStep(previous, next)) {
    return neutralKeepingButton(next);
  }

  return next;
}

function neutralKeepingButton(control: ControlFrame): ControlFrame {
  return {
    ...createNeutralControl(),
    buttonPressed: control.buttonPressed,
    buttonDown: control.buttonDown,
    buttonUp: control.buttonUp,
  };
}

function isExtreme(control: ControlFrame): boolean {
  return (
    Math.abs(control.pitch) >= M5_SETTINGS.resumePoseLimit ||
    Math.abs(control.roll) >= M5_SETTINGS.resumePoseLimit
  );
}

function hasAbruptStep(previous: ControlFrame, next: ControlFrame): boolean {
  return (
    Math.abs(next.pitch - previous.pitch) >= M5_SETTINGS.abruptStepLimit ||
    Math.abs(next.roll - previous.roll) >= M5_SETTINGS.abruptStepLimit
  );
}
